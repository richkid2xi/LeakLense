import { useEffect, useRef, useState } from "react";
import * as api from "../lib/api";
import type { FindingStatus, UiFinding as Finding, UiScanSummary, UiDomain } from "../lib/api";
import { companionEvents, SeverityLevel } from "../lib/companion/events";
import { BRAND, checks } from "../constants/marketing";
import { getDirectoryLabel, getHistoryBreadcrumb } from "../constants/routes";
import { getScoreBand, SCORE_CAPTION } from "@leaklens/shared";
import { Arrow, MaterialIcon } from "../components/common/MaterialIcon";
import { MicroLabel } from "../components/common/MicroLabel";
import { CopyBlock } from "../components/common/CopyBlock";
import { ScoreCount } from "../components/common/ScoreCount";
import { Companion } from "../components/common/Companion";
import { FindingDrawer, severityClass } from "../components/drawers/FindingDrawer";
import { LegalDocument, LegalModal } from "../components/modals/LegalModal";
import { validateScanUrl } from "../components/marketing/UrlForm";
import { supabase } from "../lib/supabase";
import { CustomDropdown } from "../components/common/CustomDropdown";
import { ExpandableFindingGroup } from "../components/common/ExpandableFindingGroup";

export type Screen = "new" | "verify" | "progress" | "results" | "history" | "apps" | "compare" | "settings" | "failed";

const scanSteps = ["Fetching app", "Reading bundle", "Checking Supabase", "Checking storage", "Building report"];
const scanMessages = [
  "Connecting to the deployed public edge",
  "Inspecting client bundles and public assets",
  "Testing public API and data access rules",
  "Reviewing cloud storage policies",
  "Synthesizing security score and exposures",
];

function formatScanCompareLabel(
  scan: api.DomainScanItem,
  allScans: api.DomainScanItem[]
): { label: string; tooltip: string } {
  const d = new Date(scan.startedAt);
  const hasSameMinute = allScans.some((other) => {
    if (other.id === scan.id) return false;
    const od = new Date(other.startedAt);
    return (
      d.getFullYear() === od.getFullYear() &&
      d.getMonth() === od.getMonth() &&
      d.getDate() === od.getDate() &&
      d.getHours() === od.getHours() &&
      d.getMinutes() === od.getMinutes()
    );
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const day = d.getDate();
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  const timeStr = hasSameMinute
    ? `${hours}:${minutes}:${seconds} ${ampm}`
    : `${hours}:${minutes} ${ampm}`;

  const totalFindings =
    (scan.countsBySeverity?.critical || 0) +
    (scan.countsBySeverity?.high || 0) +
    (scan.countsBySeverity?.medium || 0) +
    (scan.countsBySeverity?.low || 0);

  const scoreStr = scan.score != null ? String(scan.score) : "100";
  const label = `${month} ${day}, ${timeStr} · ${totalFindings} findings · score ${scoreStr}`;

  let tz = "UTC";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    // fallback
  }
  const tooltip = `${d.toLocaleString()} (${tz})`;

  return { label, tooltip };
}

export function LoggedInApp({
  initialUrl,
  onLogout,
  onViewHome,
}: {
  initialUrl?: string;
  onLogout: () => void;
  onViewHome?: () => void;
}) {
  const [screen, setScreen] = useState<Screen>(initialUrl ? "new" : "history");
  const [url, setUrl] = useState(initialUrl || "");
  const [builder, setBuilder] = useState("Lovable");
  const [verifyTab, setVerifyTab] = useState("dns");
  const [verifyStatus, setVerifyStatus] = useState<"Waiting" | "Checking" | "Verified" | "Failed">("Waiting");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [checksRun, setChecksRun] = useState<[string, string, string][]>([]);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [accountOpen, setAccountOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [urlError, setUrlError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [scans, setScans] = useState<UiScanSummary[]>([]);
  const [domains, setDomains] = useState<UiDomain[]>([]);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [profileName, setProfileName] = useState("");
  const initialParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [appFilter, setAppFilter] = useState<string>(initialParams?.get("app") || "all");
  const [resultFilter, setResultFilter] = useState<string>(initialParams?.get("result") || "all");
  const [dateFilter, setDateFilter] = useState<string>(initialParams?.get("date") || "all");

  const updateFilter = (type: "app" | "result" | "date", val: string) => {
    const nextApp = type === "app" ? val : appFilter;
    const nextResult = type === "result" ? val : resultFilter;
    const nextDate = type === "date" ? val : dateFilter;

    if (type === "app") setAppFilter(val);
    if (type === "result") setResultFilter(val);
    if (type === "date") setDateFilter(val);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (nextApp && nextApp !== "all") params.set("app", nextApp);
      else params.delete("app");

      if (nextResult && nextResult !== "all") params.set("result", nextResult);
      else params.delete("result");

      if (nextDate && nextDate !== "all") params.set("date", nextDate);
      else params.delete("date");

      const query = params.toString();
      const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  };

  const handleClearFilters = () => {
    setAppFilter("all");
    setResultFilter("all");
    setDateFilter("all");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("app");
      params.delete("result");
      params.delete("date");
      const query = params.toString();
      const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  };
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [activeScanScore, setActiveScanScore] = useState<number | null>(null);
  const [detectedStack, setDetectedStack] = useState<string[]>([]);
  const [, setScanLoading] = useState(false);
  const [verificationData, setVerificationData] = useState<api.VerificationChallenge | null>(null);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [rescanLoading, setRescanLoading] = useState<Record<string, boolean>>({});
  const [rateLimitErrors, setRateLimitErrors] = useState<Record<string, string>>({});
  const [rescanDeltas, setRescanDeltas] = useState<Record<string, number>>({});
  const [compareDomainId, setCompareDomainId] = useState<string>("");
  const [compareDomainScans, setCompareDomainScans] = useState<api.DomainScanItem[]>([]);
  const [beforeScanId, setBeforeScanId] = useState<string | null>(null);
  const [afterScanId, setAfterScanId] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<api.CompareScansResponse | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [isRescanningFromCompare, setIsRescanningFromCompare] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true);

  const mainScrollRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const hamburgerBtnRef = useRef<HTMLButtonElement>(null);
  const [copiedScanId, setCopiedScanId] = useState(false);

  const handleCopyScanId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedScanId(true);
      setTimeout(() => setCopiedScanId(false), 2000);
    } catch {}
  };

  // Reset scroll position to top on route changes
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo(0, 0);
    }
  }, [screen]);

  // Drawer accessibility: focus trap, esc listener, return focus, scroll lock
  useEffect(() => {
    if (!mobileMenuOpen) return;

    closeBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        hamburgerBtnRef.current?.focus();
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  // Toast Notification State
  interface ToastItem {
    id: string;
    message: string;
    type: "success" | "error" | "info";
  }
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Custom Confirmation Modal State (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    danger?: boolean;
    onConfirm: () => Promise<void> | void;
    isLoading?: boolean;
  } | null>(null);

  const isOverlayOpen =
    mobileMenuOpen ||
    Boolean(selected) ||
    Boolean(confirmModal?.isOpen) ||
    Boolean(legalDocument);

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      showToast("Please enter a valid display name.", "error");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profileName.trim() },
      });
      if (error) throw error;
      setUser((prev) => (prev ? { ...prev, name: profileName.trim() } : prev));
      setActionMessage("Profile details updated.");
      showToast("Username updated successfully.", "success");
    } catch (err: any) {
      setActionMessage(err.message || "Failed to update profile.");
      showToast(err.message || "Failed to update profile.", "error");
    }
  };

  const promptDeleteDomain = (id: string, hostname: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Remove App",
      description: `Are you sure you want to remove "${hostname}"? This domain will become unowned and its recorded scan history will be deleted.`,
      confirmText: "Remove App",
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteDomain(id);
          const [updatedDomains, updatedScans] = await Promise.all([
            api.getDomains(),
            api.getScans(),
          ]);
          setDomains(updatedDomains);
          setScans(updatedScans);
          setActionMessage(`Removed ${hostname}.`);
          showToast(`"${hostname}" removed from your applications.`, "info");
        } catch (err: any) {
          setActionMessage(err.message || "Failed to remove domain.");
          showToast(err.message || "Failed to remove domain.", "error");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  const promptDeleteAccount = () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Account & Workspace",
      description: "Are you sure you want to delete your account? All registered applications, verified domain ownerships, and historical scan results will be permanently removed. This action cannot be undone.",
      confirmText: "Delete Account",
      danger: true,
      onConfirm: async () => {
        try {
          for (const d of domains) {
            try {
              await api.deleteDomain(d.id);
            } catch {
              // ignore cascade errors
            }
          }
          await supabase.auth.signOut();
          setDomains([]);
          setScans([]);
          setFindings([]);
          showToast("Your account and all associated workspace data have been deleted.", "info");
          onLogout();
        } catch (err: any) {
          setActionMessage(err.message || "Failed to clear account.");
          showToast(err.message || "Failed to clear account.", "error");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        const name = authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User";
        setUser({
          email: authUser.email || "",
          name,
        });
        setProfileName(name);
      }
    });

    Promise.allSettled([
      api.getDomains().then(setDomains).catch(() => {}),
      api.getScans().then((loadedScans) => {
        setScans(loadedScans);
        const firstScan = loadedScans[0];
        if (firstScan) {
          return api.getScan(firstScan.id).then((detail) => {
            setFindings(detail.findings);
            setChecksRun(detail.checksRun.map((c) => [c.name, c.status, c.reason || ""]));
            setActiveScanId(detail.id);
            setActiveScanScore(detail.exposureScore);
            setDetectedStack(detail.detectedStack || []);
            if (detail.builder) setBuilder(detail.builder);
            if (!url && detail.url) {
              setUrl(detail.url);
            }
          }).catch(() => {});
        }
        return null;
      }).catch(() => {}),
    ]).finally(() => {
      setIsDashboardLoading(false);
    });
  }, []);

  useEffect(() => {
    if (screen !== "verify" || !url) return;
    const method = verifyTab === "file" ? "file" : verifyTab === "meta" ? "meta" : "dns";
    api.startVerification(url, method)
      .then(setVerificationData)
      .catch((err) => {
        setActionMessage(err?.message || "Failed to load verification challenge.");
      });
  }, [screen, url, verifyTab]);

  // Sync compare domain
  useEffect(() => {
    if (screen !== "compare" || domains.length === 0) return;
    const target = domains.find((d) => d.id === compareDomainId) || domains.find((d) => d.hostname === url) || domains[0];
    if (target && target.id !== compareDomainId) {
      setCompareDomainId(target.id);
    }
  }, [screen, domains, url, compareDomainId]);

  // Load domain scans for compareDomainId
  useEffect(() => {
    if (screen !== "compare" || !compareDomainId) return;

    api.getDomainScans(compareDomainId)
      .then((domainScans) => {
        setCompareDomainScans(domainScans);
        if (domainScans.length >= 2) {
          const latest = domainScans[0];
          const previous = domainScans[1];
          if (latest && previous) {
            setAfterScanId(latest.id);
            setBeforeScanId(previous.id);
          }
        } else if (domainScans.length === 1) {
          const single = domainScans[0];
          if (single) {
            setAfterScanId(single.id);
            setBeforeScanId(null);
          }
        } else {
          setAfterScanId(null);
          setBeforeScanId(null);
        }
      })
      .catch((err) => {
        console.error("Failed to load domain scans:", err);
        setCompareDomainScans([]);
      });
  }, [screen, compareDomainId]);

  // Fetch comparison when beforeScanId and afterScanId change
  useEffect(() => {
    if (screen !== "compare" || !beforeScanId || !afterScanId) {
      setComparisonResult(null);
      return;
    }

    setIsComparing(true);
    api.compareScans(beforeScanId, afterScanId)
      .then((res) => {
        setComparisonResult(res);
        setIsComparing(false);
      })
      .catch((err) => {
        console.error("Comparison error:", err);
        setIsComparing(false);
      });
  }, [screen, beforeScanId, afterScanId]);

  const nav = (next: Screen) => {
    setScreen(next);
    setSelected(null);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const trackScanProgress = (
    scanId: string,
    onSuccess?: (latest: api.UiScanDetail) => void,
    onFailure?: (msg?: string) => void
  ) => {
    setProgress(0);
    let attempts = 0;
    const maxAttempts = 60;
    const interval = window.setInterval(async () => {
      attempts++;
      try {
        const latest = await api.getScan(scanId);
        const isDone =
          latest.status === "completed" ||
          (latest.finishedAt && latest.finishedAt !== "In progress");
        const isFailed = latest.status === "failed";

        if (isDone) {
          clearInterval(interval);
          setProgress(scanSteps.length);
          setTimeout(() => {
            setScanLoading(false);
            setFindings(latest.findings);
            setChecksRun(latest.checksRun.map((c) => [c.name, c.status, c.reason || ""]));
            setActiveScanScore(latest.exposureScore);
            setDetectedStack(latest.detectedStack || []);

            api.getScans().then(setScans).catch(() => {});
            api.getDomains().then(setDomains).catch(() => {});

            const counts = {
              critical: latest.findings.filter((f) => f.severity === "Critical").length,
              high: latest.findings.filter((f) => f.severity === "High").length,
              medium: latest.findings.filter((f) => f.severity === "Medium").length,
              low: latest.findings.filter((f) => f.severity === "Low").length,
            };
            companionEvents.emit("scan_finished", {
              severityCounts: counts,
              score: latest.exposureScore,
              couldNotTestCount: latest.checksRun.filter((c) => c.status === "Couldn't test").length,
              clean: latest.findings.length === 0,
            });

            if (onSuccess) onSuccess(latest);
            setScreen("results");
            showToast(
              `Scan completed successfully for ${latest.url || url || "your app"}! Score: ${latest.exposureScore}/100`,
              "success"
            );
          }, 350);
        } else if (isFailed) {
          clearInterval(interval);
          setScanLoading(false);
          const failMsg = latest.errorMessage || "Scan execution failed.";
          if (onFailure) onFailure(failMsg);
          showToast(`Scan failed: ${failMsg}`, "error");
          nav("failed");
        } else {
          // Live stage tracking: use real stage reported by worker or progress based on check completion
          if (latest.metrics?.stepIndex != null) {
            const liveStep = Math.min(Math.max(latest.metrics.stepIndex, 0), scanSteps.length - 1);
            setProgress(liveStep);
            companionEvents.emit("scan_step_changed", {
              stepIndex: liveStep,
              stepName: scanSteps[liveStep] || "",
              stepMessage: scanMessages[liveStep] || "",
            });
          } else {
            // Checks completed fallback
            const checksCount = latest.checksRun?.length ?? 0;
            const computedStep = checksCount > 0 ? 3 : 1;
            setProgress(computedStep);
          }
        }
      } catch (err: any) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setScanLoading(false);
          const msg = err?.message || "Scan timed out.";
          if (onFailure) onFailure(msg);
          showToast(`Scan failed: ${msg}`, "error");
          nav("failed");
        }
      }
    }, 1000);
  };

  const handleRunRescanFromCompare = async () => {
    const targetDomain = domains.find((d) => d.id === compareDomainId) || domains[0];
    if (!targetDomain) return;
    try {
      setIsRescanningFromCompare(true);
      setUrl(targetDomain.hostname);
      setScanLoading(true);
      nav("progress");
      companionEvents.emit("scan_started", { url: targetDomain.hostname, builder });
      const created = await api.createScan(targetDomain.hostname, { authorized: true });
      setActiveScanId(created.id);
      trackScanProgress(created.id);
    } catch (err: any) {
      setActionMessage(err.message || "Failed to start rescan.");
    } finally {
      setIsRescanningFromCompare(false);
    }
  };

  const filtered = findings.filter(
    (f) =>
      (severityFilter === "All" || f.severity === severityFilter) &&
      (statusFilter === "All" || f.status === statusFilter)
  );
  const visibleScans = scans.filter((s) => {
    // 1. App filter
    if (appFilter !== "all") {
      if (s.hostname !== appFilter && !s.hostname?.includes(appFilter)) return false;
    }

    // 2. Result filter
    if (resultFilter === "issues") {
      if (s.status === "failed") return false;
      const hasIssues = s.scoreNumber < 100 || (s.findingCount != null && s.findingCount > 0);
      if (!hasIssues) return false;
    } else if (resultFilter === "no_issues") {
      if (s.status !== "complete") return false;
      const isClean = s.scoreNumber === 100 && (s.findingCount == null || s.findingCount === 0);
      if (!isClean) return false;
    } else if (resultFilter === "could_not_complete") {
      if (s.status !== "failed") return false;
    }

    // 3. Date filter
    if (dateFilter !== "all") {
      const scanDate = s.startedAt ? new Date(s.startedAt) : new Date(s.date);
      const scanTime = scanDate.getTime();
      if (!isNaN(scanTime)) {
        const now = new Date();
        if (dateFilter === "today") {
          const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (scanTime < todayMidnight) return false;
        } else if (dateFilter === "7d") {
          const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
          if (scanTime < cutoff) return false;
        } else if (dateFilter === "30d") {
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          if (scanTime < cutoff) return false;
        }
      }
    }

    return true;
  });
  const fixedCount = findings.filter((f) => f.status === "Fixed").length;
  const securityScore =
    activeScanScore ??
    (findings.length === 0
      ? 100
      : Math.max(20, 100 - findings.filter((f) => f.status !== "Fixed").length * 15 + fixedCount * 5));

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";
  const userName = user?.name || "Account";
  const userEmail = user?.email || "";
  const appDisplay: string =
    domains[0]?.hostname || (url ? url.replace(/^https?:\/\//, "").split("/")[0] : "") || "New App";

  const companionMessage =
    actionMessage ||
    (screen === "results"
      ? findings.length > 0
        ? `${findings.length} finding${findings.length > 1 ? "s" : ""}. Review each item below.`
        : "No exposures detected. Clean report."
      : screen === "new"
        ? "A URL first. Telepathy is still in beta."
        : screen === "verify" && verifyStatus === "Failed"
          ? "DNS is taking the scenic route. Try again in a moment."
          : screen === "progress"
            ? "You can stop staring at the progress bar. I’ve got this."
            : screen === "settings"
              ? "The danger zone is accurately named. Refreshing."
              : "I watch the public edges. Quietly, mostly.");

  useEffect(() => {
    companionEvents.emit("route_changed", { route: "app", screen });
    if (screen === "failed") {
      companionEvents.emit("scan_failed", { reason: "Connection lost during public edge analysis." });
    }
  }, [screen]);

  useEffect(() => {
    if (legalDocument) {
      companionEvents.emit("modal_opened", { modalType: legalDocument });
    } else {
      companionEvents.emit("modal_closed", {});
    }
  }, [legalDocument]);

  useEffect(() => {
    return companionEvents.on("companion_action_requested", ({ actionId }) => {
      if (actionId === "show_worst_finding") {
        const worst =
          findings.find((f) => f.severity === "Critical") ||
          findings.find((f) => f.severity === "High") ||
          findings[0];
        if (worst) {
          handleSelectFinding(worst);
        }
      } else if (actionId === "show_verification_steps") {
        nav("verify");
      }
    });
  }, [findings]);

  useEffect(() => {
    if (screen !== "progress") return;
    setElapsed(0);
    const timer = window.setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [screen]);

  const verify = async () => {
    const method = verifyTab === "file" ? "file" : verifyTab === "meta" ? "meta" : "dns";
    companionEvents.emit("verification_started", { method, domain: url });
    setVerifyStatus("Checking");
    setActionMessage("Checking verification records on your site...");
    let result = await api.checkVerification(url, method);

    // If active tab method was not found, check if any other verification method is in place
    if (result.status !== "Verified") {
      const autoRes = await api.checkVerification(url, "auto");
      if (autoRes.status === "Verified") {
        result = autoRes;
      }
    }

    setVerifyStatus(result.status);
    if (result.status === "Verified") {
      companionEvents.emit("verification_succeeded", { domain: url });
      api.getDomains().then(setDomains).catch(() => {});
      setActionMessage("Domain ownership verified successfully! You can now start the scan.");
      showToast(`Domain "${url}" verified successfully! Ready to scan.`, "success");
    } else {
      const failReason = result.message || "We could not find the verification value on your site yet.";
      companionEvents.emit("verification_failed", {
        reason: failReason,
      });
      setActionMessage(failReason);
      showToast(`Verification failed: ${failReason}`, "error");
    }
  };

  const startRealScan = async () => {
    try {
      setScanLoading(true);
      nav("progress");
      companionEvents.emit("scan_started", { url, builder });

      const created = await api.createScan(url, {
        authorized: true,
        builder: builder === "Other / not sure" ? "Other" : (builder as any),
      });

      setActiveScanId(created.id);
      trackScanProgress(created.id);
    } catch (err: any) {
      setScanLoading(false);
      setActionMessage(err?.message || "Failed to start scan.");
      showToast(err?.message || "Failed to start scan.", "error");
      nav("failed");
    }
  };

  const handleRescanApp = async (domain: UiDomain) => {
    // Check if scan is already running for this app
    const isRunning = scans.some(
      (s) => (s.hostname === domain.hostname || s.id === activeScanId) && s.status === "running"
    );
    if (isRunning) return;

    setRescanLoading((prev) => ({ ...prev, [domain.id]: true }));
    setRateLimitErrors((prev) => {
      const next = { ...prev };
      delete next[domain.id];
      return next;
    });

    try {
      setUrl(domain.hostname);
      setScanLoading(true);
      nav("progress");
      companionEvents.emit("scan_started", { url: domain.hostname, builder });

      const created = await api.createScan(domain.hostname, {
        authorized: true,
        builder: builder === "Other / not sure" ? "Other" : (builder as any),
      });

      setActiveScanId(created.id);
      trackScanProgress(
        created.id,
        (latest) => {
          setRescanLoading((prev) => ({ ...prev, [domain.id]: false }));
          const prevScore = domain.latestScore ?? 100;
          const newScore = latest.exposureScore;
          const delta = newScore - prevScore;
          setRescanDeltas((prev) => ({ ...prev, [domain.id]: delta }));
        },
        () => {
          setRescanLoading((prev) => ({ ...prev, [domain.id]: false }));
        }
      );
    } catch (err: any) {
      setScanLoading(false);
      setRescanLoading((prev) => ({ ...prev, [domain.id]: false }));
      if (err?.status === 429 || err?.retryAfter) {
        const waitSec = err.retryAfter ? `${err.retryAfter}s` : "a few moments";
        const msg = `Rate limit exceeded. Try again in ${waitSec}.`;
        setRateLimitErrors((prev) => ({
          ...prev,
          [domain.id]: msg,
        }));
        setActionMessage(msg);
        showToast(msg, "error");
      } else {
        const msg = err?.message || "Failed to start rescan.";
        setActionMessage(msg);
        showToast(msg, "error");
      }
    }
  };

  const continueToVerification = () => {
    const nextError = validateScanUrl(url);
    if (nextError) {
      setUrlError(nextError);
      setActionMessage(nextError);
      companionEvents.emit("error_shown", { message: nextError, context: "scan_url" });
      return;
    }
    if (!authorized) {
      const authErr = "Confirm that you own this site or are authorised to scan it.";
      setUrlError(authErr);
      setActionMessage("Ownership first. Even simulated scanners need boundaries.");
      companionEvents.emit("error_shown", { message: authErr, context: "ownership_checkbox" });
      return;
    }

    setUrlError("");
    const cleanHost = (url.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] || "").split(":")[0] || "";

    // 1. Instantly navigate to verify screen so challenge displays with ZERO delay
    nav("verify");

    // 2. Preload challenge immediately
    const method = verifyTab === "file" ? "file" : verifyTab === "meta" ? "meta" : "dns";
    api.startVerification(url, method)
      .then(setVerificationData)
      .catch(() => {});

    // 3. Check if domain is already recorded as verified in user's saved domains
    const alreadyVerified = domains.some(
      (d) => d.hostname.toLowerCase() === cleanHost && d.status === "verified"
    );

    if (alreadyVerified) {
      setVerifyStatus("Verified");
      setActionMessage("Domain is already verified in your account! Ready to scan.");
      return;
    }

    // 4. Set checking status and probe site in background
    setVerifyStatus("Checking");
    setIsCheckingVerification(true);
    setActionMessage("Detecting verification methods on your site...");

    api.checkVerification(url, "auto")
      .then((checkResult) => {
        if (checkResult.status === "Verified") {
          setVerifyStatus("Verified");
          setActionMessage("Existing verification detected on your site! Ready to scan.");
          companionEvents.emit("verification_succeeded", { domain: url });
          api.getDomains().then(setDomains).catch(() => {});
        } else {
          setVerifyStatus("Waiting");
          setActionMessage(
            "No verification detected yet. Please complete one of the verification options below to prove domain ownership."
          );
        }
      })
      .catch(() => {
        setVerifyStatus("Waiting");
        setActionMessage(
          "No verification detected yet. Please complete one of the verification options below to prove domain ownership."
        );
      })
      .finally(() => {
        setIsCheckingVerification(false);
      });
  };

  const handleSelectFinding = (f: Finding) => {
    setSelected(f);
    companionEvents.emit("finding_opened", {
      id: f.id,
      title: f.title,
      severity: f.severity as SeverityLevel,
      category: f.where,
      where: f.where,
    });
  };

  const updateStatus = async (status: Finding["status"]) => {
    if (selected) {
      await api.markFindingStatus(selected.id, status as FindingStatus);
      setFindings((items) => items.map((f) => (f.id === selected.id ? { ...f, status } : f)));
      setSelected({ ...selected, status });
      companionEvents.emit("finding_status_changed", { findingId: selected.id, newStatus: status });
    }
  };

  return (
    <div className="app-shell">
      {/* Mobile backdrop scrim */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={drawerRef}
        className={`app-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}
        aria-label="Main navigation"
        aria-hidden={!mobileMenuOpen ? true : undefined}
      >
        <div className="sidebar-header-row">
          <button className="app-logo" onClick={() => { nav("history"); setMobileMenuOpen(false); }}>
            {BRAND}
            <sup>®</sup>
          </button>
          <button
            ref={closeBtnRef}
            className="mobile-close-btn"
            onClick={() => {
              setMobileMenuOpen(false);
              hamburgerBtnRef.current?.focus();
            }}
            aria-label="Close navigation"
          >
            <MaterialIcon>close</MaterialIcon>
          </button>
        </div>
        <button className="sidebar-new" onClick={() => { nav("new"); setMobileMenuOpen(false); }}>
          <MaterialIcon>add</MaterialIcon> <span>New scan</span>
        </button>
        <nav>
          <button
            className={["history", "results", "compare", "failed"].includes(screen) ? "active" : ""}
            onClick={() => { nav("history"); setMobileMenuOpen(false); }}
          >
            <MaterialIcon>radar</MaterialIcon><span>Scans</span>
          </button>
          <button onClick={() => { nav("apps"); setMobileMenuOpen(false); }} className={screen === "apps" ? "active" : ""}>
            <MaterialIcon>apps</MaterialIcon><span>Apps</span>
          </button>
          <button onClick={() => { nav("settings"); setMobileMenuOpen(false); }} className={screen === "settings" ? "active" : ""}>
            <MaterialIcon>settings</MaterialIcon><span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-profile-block">
          {/* Mobile view only: user name only (no avatar, no email) */}
          <div className="mobile-only-username">
            <span className="sidebar-mobile-name">{userName}</span>
          </div>

          <div className="sidebar-footer-actions">
            {onViewHome && (
              <button
                type="button"
                className="drawer-action-btn mobile-only-action"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onViewHome();
                }}
              >
                <MaterialIcon>home</MaterialIcon> <span>Landing page</span>
              </button>
            )}
            <button
              type="button"
              className="drawer-action-btn logout-btn"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
            >
              <MaterialIcon>logout</MaterialIcon> <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              ref={hamburgerBtnRef}
              className="mobile-hamburger-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <MaterialIcon>menu</MaterialIcon>
            </button>
            <div className="topbar-breadcrumb">
              <span className="crumb-brand">LeakLens</span>
              <span className="crumb-divider">/</span>
              <span className="crumb-screen">
                {getDirectoryLabel(screen, appFilter)}
              </span>
            </div>
          </div>
          <div className="account-wrap desktop-only-account">
            <button className="account-button" onClick={() => setAccountOpen(!accountOpen)}>
              <span>{userInitials}</span>{userName} <MaterialIcon>expand_more</MaterialIcon>
            </button>
            {accountOpen && (
              <div className="account-menu">
                {onViewHome && <button onClick={onViewHome}>Landing page</button>}
                <button onClick={() => nav("settings")}>Account settings</button>
                <button onClick={onLogout}>Log out</button>
              </div>
            )}
          </div>
        </header>
        <main className="app-scroll-container" ref={mainScrollRef}>
          <div className="app-content">
          <div className="screen-transition" key={screen}>
            {screen === "new" && (
              <section className="app-screen">
                <div className="app-page-title">
                  <MicroLabel>NEW SCAN</MicroLabel>
                  <h1>What should we check?</h1>
                  <p>Choose your deployed app and the read-only checks to run.</p>
                </div>
                <div className="app-form-card">
                  <label>
                    APP URL
                    <input
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setUrlError("");
                        setActionMessage("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          continueToVerification();
                        }
                      }}
                      placeholder="https://your-app.com"
                      aria-invalid={Boolean(urlError)}
                    />
                    {urlError && (
                      <p className="field-error">
                        <MaterialIcon>error</MaterialIcon>
                        {urlError}
                      </p>
                    )}
                  </label>
                  <fieldset>
                    <legend>BUILDER</legend>
                    <div className="builder-select">
                      {["Lovable", "Bolt", "Cursor", "v0", "Other / not sure"].map((x) => (
                        <button className={builder === x ? "active" : ""} onClick={() => setBuilder(x)} key={x}>
                          {x}
                        </button>
                      ))}
                    </div>
                    <p className="field-helper">
                      Built by hand or not sure? Choose Other. We detect issues from what your site exposes, not from
                      the builder.
                    </p>
                  </fieldset>
                  <fieldset>
                    <legend>CHECKS</legend>
                    <div className="app-checks">
                      {checks.map((x) => (
                        <label key={x}>
                          <input type="checkbox" defaultChecked /> <span>{x}</span>
                        </label>
                      ))}
                    </div>
                    <a className="coverage-link" href="/#coverage">
                      What we check and don't check
                    </a>
                  </fieldset>
                  <label className="ownership-check">
                    <input
                      type="checkbox"
                      checked={authorized}
                      onChange={(e) => {
                        setAuthorized(e.target.checked);
                        setUrlError("");
                      }}
                    />
                    I own this site, or I'm authorised to scan it.
                  </label>
                  <button
                    className="button primary app-action"
                    onClick={continueToVerification}
                    disabled={isCheckingVerification}
                  >
                    {isCheckingVerification ? (
                      "Checking verification methods..."
                    ) : (
                      <>
                        Continue to verification <Arrow />
                      </>
                    )}
                  </button>
                  <p className="scan-consent app-consent">
                    By continuing, you agree to the{" "}
                    <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and acknowledge the{" "}
                    <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.
                  </p>
                </div>
                <div className="empty-state">
                  <MicroLabel>NO OTHER DRAFTS</MicroLabel>
                  <p>Every new scan will appear here until you start it.</p>
                  <button onClick={() => document.querySelector<HTMLInputElement>(".app-form-card input")?.focus()}>
                    Enter an app URL
                  </button>
                </div>
              </section>
            )}

            {screen === "verify" && (
              <section className="app-screen">
                <button className="app-back" onClick={() => nav("new")}>
                  <MaterialIcon>arrow_back</MaterialIcon> BACK TO SCAN
                </button>
                <div className="app-page-title">
                  <MicroLabel>OWNERSHIP / REQUIRED</MicroLabel>
                  <h1>Verify {url || "your app"}.</h1>
                  <p>We ask for proof so LeakLens only scans apps you own.</p>
                </div>
                <div className="verify-card">
                  <div className="app-tabs">
                    <button className={verifyTab === "dns" ? "active" : ""} onClick={() => setVerifyTab("dns")}>
                      DNS TXT record
                    </button>
                    <button className={verifyTab === "meta" ? "active" : ""} onClick={() => setVerifyTab("meta")}>
                      HTML meta tag
                    </button>
                    <button className={verifyTab === "file" ? "active" : ""} onClick={() => setVerifyTab("file")}>
                      Verification file
                    </button>
                  </div>
                  <p>
                    {verifyTab === "dns"
                      ? "Add this TXT record to your domain, then return here."
                      : verifyTab === "meta"
                        ? "Add this tag inside the <head> of your deployed app."
                        : "Create this public file with the exact contents shown below."}
                  </p>
                  {(() => {
                    const fallbackHost = ((url || "your-app.com").replace(/^https?:\/\//, "").split("/")[0] || "").split(":")[0] || "your-app.com";
                    const fallbackSlug = fallbackHost.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
                    return (
                      <>
                        <CopyBlock
                          value={
                            verifyTab === "dns"
                              ? (verificationData?.dnsValue || `leaklens-verification=ll_${fallbackSlug}`)
                              : verifyTab === "meta"
                                ? (verificationData?.metaTagSnippet || `<meta name="leaklens-verification" content="ll_${fallbackSlug}" />`)
                                : verificationData
                                  ? `${verificationData.filePath}\n${verificationData.fileContent}`
                                  : `/.well-known/leaklens.txt\nleaklens-verification=ll_${fallbackSlug}`
                          }
                        />
                        {verifyTab === "dns" && (
                          <p className="verify-note">
                            Host: <code>{verificationData?.dnsHost || `_leaklens.${fallbackHost}`}</code> &bull; Type: <code>TXT</code>
                          </p>
                        )}
                      </>
                    );
                  })()}
                  {verifyTab === "file" && (
                    <p className="verify-note">
                      Path: <code>{verificationData?.filePath || "/.well-known/leaklens.txt"}</code>
                    </p>
                  )}
                  <p className="verify-note">Each domain and subdomain is verified separately.</p>
                  <div className={`live-status status-${verifyStatus.toLowerCase()}`}>
                    <i />
                    <div>
                      <MicroLabel>LIVE STATUS</MicroLabel>
                      <strong>{verifyStatus === "Waiting" ? "Unverified" : verifyStatus}</strong>
                      {actionMessage && <p>{actionMessage}</p>}
                    </div>
                  </div>
                  {verifyStatus === "Verified" ? (
                    <button className="button primary app-action" onClick={startRealScan}>
                      Start read-only scan <Arrow />
                    </button>
                  ) : (
                    <button
                      className="button primary app-action"
                      onClick={verify}
                      disabled={verifyStatus === "Checking"}
                    >
                      {verifyStatus === "Checking" ? "Checking verification..." : <>Verify now <Arrow /></>}
                    </button>
                  )}
                  <p className="scan-consent app-consent">
                    Starting a scan confirms your authorisation and acceptance of the{" "}
                    <button onClick={() => setLegalDocument("terms")}>Terms of Service</button> and{" "}
                    <button onClick={() => setLegalDocument("privacy")}>Privacy Policy</button>.
                  </p>
                </div>
              </section>
            )}

            {screen === "progress" && (
              <section className="app-screen">
                <div className="app-page-title">
                  <MicroLabel>SCAN {activeScanId ? `LL-${activeScanId.slice(0, 8).toUpperCase()}` : "RUNNING"} / IN PROGRESS</MicroLabel>
                  <h1>Looking at the public edges.</h1>
                  <p>You can leave this page. No changes are being made.</p>
                </div>
                <div className="progress-card">
                  <div className="progress-meta">
                    <span>
                      ELAPSED <b>00:{String(elapsed).padStart(2, "0")}</b>
                    </span>
                    <span>{Math.min(progress, scanSteps.length)} / {scanSteps.length} CHECKS</span>
                  </div>
                  <div className="progress-rule">
                    <i style={{ width: `${Math.min((progress / scanSteps.length) * 100, 100)}%` }} />
                  </div>
                  <div className="scan-stepper">
                    {scanSteps.map((step, i) => (
                      <div className={i < progress ? "done" : i === progress ? "current" : ""} key={step}>
                        <i>{i < progress ? <MaterialIcon>check</MaterialIcon> : String(i + 1).padStart(2, "0")}</i>
                        <strong>
                          {step}
                          <small>{i === progress ? scanMessages[i] : ""}</small>
                        </strong>
                        <span>{i < progress ? "Complete" : i === progress ? "Checking" : "Waiting"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {screen === "failed" && (
              <section className="app-screen">
                <div className="app-page-title">
                  <MicroLabel>SCAN FAILED</MicroLabel>
                  <h1>We lost the connection.</h1>
                  <p>The scan stopped before any checks completed. Your app was not changed.</p>
                </div>
                <div className="error-state">
                  <span>!</span>
                  <p>We couldn’t reach the app long enough to finish this scan.</p>
                  <button className="button primary" onClick={() => nav("new")}>
                    Try the scan again
                  </button>
                </div>
              </section>
            )}

            {screen === "results" && (
              <section className="app-screen">
                <div className="results-hero">
                  <div>
                    <MicroLabel>EXPOSURE SCORE</MicroLabel>
                    <h1>
                      <span className="count-score">
                        <ScoreCount target={securityScore} />
                      </span>
                      <sup>/100</sup>
                    </h1>
                    <p>
                      {getScoreBand(securityScore).label}
                      {checksRun.some(([, status]) => status.toLowerCase().replace(/['\s_-]/g, "") === "couldnottest") && (
                        <span className="not-fully-tested" style={{ marginLeft: 8, fontSize: "0.85em", opacity: 0.85 }}>
                          · not fully tested
                        </span>
                      )}
                    </p>
                    <small>{SCORE_CAPTION}</small>
                    {findings.some((f) => f.severity === "Critical") && (
                      <button
                        className="review-critical"
                        onClick={() => {
                          setSeverityFilter("Critical");
                          document.querySelector(".findings-table")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Review critical findings <MaterialIcon>arrow_downward</MaterialIcon>
                      </button>
                    )}
                  </div>
                  <div className="severity-summary">
                    {["Critical", "High", "Medium", "Low"].map((s) => (
                      <div key={s}>
                        <i className={severityClass(s)} />
                        <strong>{findings.filter((f) => f.severity === s).length}</strong>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="scan-meta">
                  <div className="scan-meta-grid">
                    <div className="scan-meta-item">
                      <span className="scan-meta-label">SCAN ID</span>
                      <span className="scan-meta-value scan-meta-id">
                        <code>{activeScanId ? `${activeScanId.slice(0, 10)}…` : "LL-LIVE"}</code>
                        <button
                          type="button"
                          className="copy-scan-id-btn"
                          onClick={() => handleCopyScanId(activeScanId || "LL-LIVE")}
                          title="Copy Scan ID"
                          aria-label="Copy Scan ID"
                        >
                          <MaterialIcon>{copiedScanId ? "check" : "content_copy"}</MaterialIcon>
                        </button>
                      </span>
                    </div>
                    <div className="scan-meta-item">
                      <span className="scan-meta-label">APP</span>
                      <span className="scan-meta-value">{url || appDisplay}</span>
                    </div>
                    <div className="scan-meta-item">
                      <span className="scan-meta-label">BUILDER</span>
                      <span className="scan-meta-value">{builder}</span>
                    </div>
                    <div className="scan-meta-item">
                      <span className="scan-meta-label">STATUS</span>
                      <span className="scan-meta-value">
                        {scans.find((s) => s.id === activeScanId)?.status === "complete" ? "COMPLETE" : "JUST NOW"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="compare-rescan-btn"
                    onClick={() => nav("compare")}
                  >
                    COMPARE RESCAN <MaterialIcon>arrow_forward</MaterialIcon>
                  </button>
                </div>
                <div className="detected-stack">
                  <MicroLabel>DETECTED AUTOMATICALLY</MicroLabel>
                  {detectedStack.length > 0 ? (
                    detectedStack.map((tech) => <span key={tech}>{tech}</span>)
                  ) : (
                    <span className="muted-pill">None detected</span>
                  )}
                </div>
                <div className="checks-run">
                  <div className="checks-run-head">
                    <MicroLabel>CHECKS RUN</MicroLabel>
                    <a href="/#coverage" className="view-coverage-link">View coverage</a>
                  </div>
                  {checksRun.map(([name, status, reason]) => (
                    <div className="check-run-row" key={name}>
                      <div className="check-run-info">
                        <span className="check-name">{name}</span>
                        {reason && <small className="check-reason">{reason}</small>}
                      </div>
                      <b className={`check-status status-pill ${status.toLowerCase().replaceAll(" ", "-").replace("'", "")}`}>
                        {status}
                      </b>
                    </div>
                  ))}
                </div>
                {findings.length > 0 && (
                  <div className="table-toolbar">
                    <div className="severity-chips-scroll-wrap">
                      <div className="severity-chips-row">
                        <button
                          type="button"
                          className={severityFilter === "All" ? "active" : ""}
                          onClick={() => setSeverityFilter("All")}
                        >
                          All severities ({findings.length})
                        </button>
                        {["Critical", "High", "Medium", "Low"].map((x) => (
                          <button
                            type="button"
                            className={severityFilter === x ? "active" : ""}
                            onClick={() => setSeverityFilter(x)}
                            key={x}
                          >
                            {x} ({findings.filter((f) => f.severity === x).length})
                          </button>
                        ))}
                      </div>
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      aria-label="Filter findings by status"
                      className="status-filter-select"
                    >
                      <option>All</option>
                      <option>Open</option>
                      <option>Fixed</option>
                      <option>Ignored</option>
                    </select>
                  </div>
                )}
                {findings.length === 0 ? (
                  <div className="empty-state clean-state">
                    <MaterialIcon>verified_user</MaterialIcon>
                    <MicroLabel>0 EXPOSURES DETECTED</MicroLabel>
                    <h3>All security checks passed.</h3>
                    <p>
                      We did not detect any public secrets, vulnerable configurations, or exposed endpoints in this scan.
                    </p>
                  </div>
                ) : filtered.length ? (
                  <div className="findings-table">
                    <div className="table-row table-head">
                      <span>Severity</span>
                      <span>Finding</span>
                      <span>Where</span>
                      <span>Status</span>
                    </div>
                    {filtered.map((f) => (
                      <button
                        type="button"
                        className="table-row finding-card"
                        onClick={() => handleSelectFinding(f)}
                        key={f.id}
                      >
                        <div className="finding-card-top">
                          <span className="finding-severity">
                            <i className={`severity-dot ${severityClass(f.severity)}`} />
                            {f.severity}
                          </span>
                          <span className="finding-status-badge">{f.status}</span>
                        </div>
                        <strong className="finding-card-title">{f.title}</strong>
                        <div className="finding-card-bottom">
                          <code className="finding-card-where">{f.where}</code>
                          <span className="finding-card-chevron">
                            <MaterialIcon>chevron_right</MaterialIcon>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <MicroLabel>NO MATCHES</MicroLabel>
                    <p>No findings match these filters.</p>
                    <button
                      onClick={() => {
                        setSeverityFilter("All");
                        setStatusFilter("All");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                <p className="report-disclaimer">
                  {BRAND} checks only the issues listed in our <a href="/#coverage">coverage section</a>. Not a
                  guarantee of security.
                </p>
              </section>
            )}

            {screen === "compare" && (() => {
              const selectedCompareDomain = domains.find((d) => d.id === compareDomainId) || domains[0];
              const scanOptions = compareDomainScans.map((s) => {
                const formatted = formatScanCompareLabel(s, compareDomainScans);
                return {
                  value: s.id,
                  label: formatted.label,
                  sublabel: formatted.tooltip,
                };
              });

              return (
                <section className="app-screen">
                  <button className="app-back" onClick={() => nav(activeScanId ? "results" : "history")}>
                    <MaterialIcon>arrow_back</MaterialIcon> BACK
                  </button>
                  <div className="app-page-title row-title">
                    <div>
                      <MicroLabel>
                        RESCAN COMPARISON / {(selectedCompareDomain?.hostname || appDisplay || "ALL APPS").toUpperCase()}
                      </MicroLabel>
                      <h1>Compare rescans.</h1>
                      <p>Track which exposures were resolved, introduced, or carried over between deployments.</p>
                    </div>
                    {domains.length > 1 && (
                      <div style={{ minWidth: 200 }}>
                        <CustomDropdown
                          label="App"
                          value={compareDomainId || ""}
                          options={domains.map((d) => ({
                            value: d.id,
                            label: d.hostname,
                          }))}
                          onChange={(val) => setCompareDomainId(val)}
                          ariaLabel="Select app to compare"
                        />
                      </div>
                    )}
                  </div>

                  {compareDomainScans.length < 2 ? (
                    <div className="empty-state" style={{ marginTop: 24, padding: "48px 24px" }}>
                      <MicroLabel>INSUFFICIENT SCANS</MicroLabel>
                      <p style={{ margin: "12px 0 20px" }}>
                        {compareDomainScans.length === 1
                          ? `Only 1 scan recorded for ${selectedCompareDomain?.hostname || "this app"}. At least two scans are required to compare results.`
                          : `No scans recorded for ${selectedCompareDomain?.hostname || "this app"}. Run a scan to establish a baseline.`}
                      </p>
                      <button
                        type="button"
                        className="button primary"
                        onClick={handleRunRescanFromCompare}
                        disabled={isRescanningFromCompare}
                      >
                        {isRescanningFromCompare ? "Starting scan..." : "Run a rescan"} <Arrow />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="compare-dropdowns-bar">
                        <CustomDropdown
                          label="Before"
                          value={beforeScanId || ""}
                          options={scanOptions}
                          onChange={(val) => setBeforeScanId(val)}
                          ariaLabel="Select before scan"
                        />
                        <div className="compare-arrow-divider" style={{ padding: "0 4px", color: "var(--muted)", alignSelf: "center", marginTop: 18 }}>
                          <MaterialIcon>arrow_forward</MaterialIcon>
                        </div>
                        <CustomDropdown
                          label="After"
                          value={afterScanId || ""}
                          options={scanOptions}
                          onChange={(val) => setAfterScanId(val)}
                          ariaLabel="Select after scan"
                        />
                      </div>

                      <div className="compare-scores" style={{ opacity: isComparing ? 0.6 : 1, transition: "opacity 150ms" }}>
                        <div>
                          <MicroLabel>BEFORE</MicroLabel>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                            <strong>{comparisonResult?.beforeScore ?? "—"}</strong>
                            <span>/100</span>
                          </div>
                          {comparisonResult?.beforeScore != null && (
                            <small className="score-band-sub" style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginTop: 4 }}>
                              {getScoreBand(comparisonResult.beforeScore).label}
                            </small>
                          )}
                        </div>
                        <div style={{ textAlign: "center" }}>
                          {comparisonResult?.deltaScore != null ? (
                            <span
                              className={`score-delta ${
                                comparisonResult.deltaScore > 0
                                  ? "positive"
                                  : comparisonResult.deltaScore < 0
                                    ? "negative"
                                    : "neutral"
                              }`}
                              style={{ fontSize: 16, padding: "6px 14px", display: "inline-block" }}
                            >
                              {comparisonResult.deltaScore > 0 ? `+${comparisonResult.deltaScore}` : comparisonResult.deltaScore}
                            </span>
                          ) : (
                            <i><MaterialIcon>arrow_forward</MaterialIcon></i>
                          )}
                        </div>
                        <div>
                          <MicroLabel>AFTER</MicroLabel>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                            <strong>{comparisonResult?.afterScore ?? "—"}</strong>
                            <span>/100</span>
                          </div>
                          {comparisonResult?.afterScore != null && (
                            <small className="score-band-sub" style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginTop: 4 }}>
                              {getScoreBand(comparisonResult.afterScore).label}
                            </small>
                          )}
                        </div>
                      </div>

                      <div className="compare-grid-4">
                        <ExpandableFindingGroup
                          title="Resolved"
                          count={comparisonResult?.counts?.resolved ?? 0}
                          type="resolved"
                          findings={comparisonResult?.resolved ?? []}
                        />
                        <ExpandableFindingGroup
                          title="New"
                          count={comparisonResult?.counts?.new ?? 0}
                          type="new"
                          findings={comparisonResult?.new ?? []}
                        />
                        <ExpandableFindingGroup
                          title="Unchanged"
                          count={comparisonResult?.counts?.unchanged ?? 0}
                          type="unchanged"
                          findings={comparisonResult?.unchanged ?? []}
                        />
                        <ExpandableFindingGroup
                          title="Not tested"
                          count={comparisonResult?.counts?.notTested ?? 0}
                          type="notTested"
                          findings={comparisonResult?.notTested ?? []}
                        />
                      </div>
                    </>
                  )}

                  <p className="report-disclaimer">
                    {BRAND} checks only the issues listed in our <a href="/#coverage">coverage section</a>. Not a
                    guarantee of security.
                  </p>
                </section>
              );
            })()}

            {screen === "history" && (
              <section className="app-screen">
                <div className="app-page-title row-title history-page-header">
                  <div>
                    <MicroLabel>{getHistoryBreadcrumb(appFilter)}</MicroLabel>
                    <h1>Scan history.</h1>
                  </div>
                  <button className="button primary new-scan-btn-compact" onClick={() => nav("new")}>
                    New scan <Arrow />
                  </button>
                </div>

                <div className="table-toolbar scans-filter-toolbar">
                  <div className="scans-filter-grid">
                    <div className="scans-filter-app">
                      <CustomDropdown
                        label="App"
                        value={appFilter}
                        options={[
                          { value: "all", label: "All apps" },
                          ...domains
                            .filter((d) => d.status === "verified" || Boolean(d.verifiedAt))
                            .map((d) => ({
                              value: d.hostname,
                              label: d.hostname,
                            })),
                        ]}
                        onChange={(val) => updateFilter("app", val)}
                        ariaLabel="Filter by app"
                      />
                    </div>
                    <div className="scans-filter-result">
                      <CustomDropdown
                        label="Result"
                        value={resultFilter}
                        options={[
                          { value: "all", label: "All" },
                          { value: "issues", label: "Issues found" },
                          { value: "no_issues", label: "No issues found" },
                          { value: "could_not_complete", label: "Could not complete" },
                        ]}
                        onChange={(val) => updateFilter("result", val)}
                        ariaLabel="Filter by result"
                      />
                    </div>
                    <div className="scans-filter-date">
                      <CustomDropdown
                        label="Date"
                        value={dateFilter}
                        options={[
                          { value: "all", label: "All time" },
                          { value: "today", label: "Today" },
                          { value: "7d", label: "Last 7 days" },
                          { value: "30d", label: "Last 30 days" },
                        ]}
                        onChange={(val) => updateFilter("date", val)}
                        ariaLabel="Filter by date"
                      />
                    </div>
                  </div>
                  {(appFilter !== "all" || resultFilter !== "all" || dateFilter !== "all") && (
                    <button
                      type="button"
                      className="text-action clear-filters-btn"
                      onClick={handleClearFilters}
                    >
                      Clear filters
                    </button>
                  )}
                </div>

                {isDashboardLoading ? (
                  <div className="history-table skeleton-table" aria-label="Loading scan history">
                    <div className="history-row head">
                      <span>Date</span>
                      <span>App / Scan</span>
                      <span>Score</span>
                      <span>Exposure Trend</span>
                      <span>Status</span>
                    </div>
                    {[1, 2, 3, 4].map((i) => (
                      <div className="history-row scan-history-card skeleton-row" key={i}>
                        <span className="skeleton-cell skeleton-date" />
                        <div className="history-target history-host-col">
                          <span className="skeleton-cell skeleton-host" />
                          <span className="skeleton-cell skeleton-scanid" />
                        </div>
                        <span className="skeleton-cell skeleton-score" />
                        <span className="skeleton-cell skeleton-trend" />
                        <span className="skeleton-cell skeleton-status" />
                      </div>
                    ))}
                  </div>
                ) : visibleScans.length === 0 ? (
                  <div className="empty-state">
                    <MicroLabel>{scans.length === 0 ? "NO SCANS YET" : "NO MATCHING SCANS"}</MicroLabel>
                    <p>
                      {scans.length === 0
                        ? "No scans recorded yet. Run your first read-only scan to see historical reports and exposure trends."
                        : "No scans match the selected filters."}
                    </p>
                    {scans.length === 0 ? (
                      <button onClick={() => nav("new")}>Run first scan</button>
                    ) : (
                      <button onClick={handleClearFilters}>Clear filters</button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="history-table">
                      <div className="history-row head">
                        <span>Date</span>
                        <span>App / Scan</span>
                        <span>Score</span>
                        <span>Exposure Trend</span>
                        <span>Status</span>
                      </div>
                      {visibleScans.map((r) => (
                        <button
                          type="button"
                          className="history-row scan-history-card"
                          key={r.id}
                          onClick={() => {
                            setActiveScanId(r.id);
                            api
                              .getScan(r.id)
                              .then((detail) => {
                                setFindings(detail.findings);
                                setChecksRun(detail.checksRun.map((c) => [c.name, c.status, c.reason || ""]));
                                setActiveScanScore(detail.exposureScore);
                                setDetectedStack(detail.detectedStack || []);
                                if (detail.builder) setBuilder(detail.builder);
                                if (detail.url) setUrl(detail.url);
                                if (r.status === "failed") nav("failed");
                                else nav("results");
                              })
                              .catch(() => nav("results"));
                          }}
                        >
                          <span className="history-date">{r.date}</span>
                          <div className="history-target history-host-col">
                            <strong className="history-host">{r.hostname || appDisplay}</strong>
                            <code className="history-scanid">LL-{r.id.slice(0, 8)}</code>
                          </div>
                          <strong className="history-score">{r.score}</strong>
                          <span className="spark history-trend">
                            {(r.trend && r.trend.length > 0 ? r.trend : [r.scoreNumber || 100]).map((sc, idx) => (
                              <i
                                key={idx}
                                style={{
                                  height: `${Math.max(15, Math.min(100, sc))}%`,
                                  background: sc === 100 ? "var(--passed)" : sc >= 80 ? "var(--blue-light)" : "var(--critical)",
                                }}
                                title={`Score: ${sc}/100`}
                              />
                            ))}
                          </span>
                          <span className={`history-status ${r.status}`}>
                            {r.status === "complete" ? "Completed" : r.status === "running" ? "Running" : "Failed"}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="empty-state">
                      <MicroLabel>END OF HISTORY</MicroLabel>
                      <p>Earlier scans will appear here when they exist.</p>
                      <button onClick={() => nav("new")}>Run another scan</button>
                    </div>
                  </>
                )}
              </section>
            )}

            {screen === "apps" && (
              <section className="app-screen">
                <div className="app-page-title row-title">
                  <div>
                    <MicroLabel>YOUR APPS ({domains.length})</MicroLabel>
                    <h1>Your apps.</h1>
                    <p>Verified and registered apps monitored by LeakLens.</p>
                  </div>
                  <button className="button primary" onClick={() => nav("new")}>
                    Add an app <Arrow />
                  </button>
                </div>
                <div className="apps-grid">
                  {isDashboardLoading ? (
                    [1, 2].map((i) => (
                      <div className="app-card skeleton-card" key={i}>
                        <span className="skeleton-cell skeleton-app-title" />
                        <span className="skeleton-cell skeleton-app-meta" />
                        <span className="skeleton-cell skeleton-app-actions" />
                      </div>
                    ))
                  ) : domains.length === 0 ? (
                    <div className="empty-app-card">
                      <MicroLabel>NO APPS REGISTERED</MicroLabel>
                      <p>Your verified apps will appear here after running your first scan.</p>
                      <button onClick={() => nav("new")}>Add an app</button>
                    </div>
                  ) : (
                    domains.map((d) => {
                      const isExpired =
                        d.status === "expired" ||
                        Boolean(d.expiresAt && new Date(d.expiresAt).getTime() <= Date.now());
                      const isVerifiedActive = d.status === "verified" && !isExpired;
                      const isRunning =
                        scans.some(
                          (s) =>
                            Boolean(s.hostname && (s.hostname === d.hostname || s.hostname.includes(d.hostname))) &&
                            s.status === "running"
                        ) || Boolean(rescanLoading[d.id]);
                      const isRescanning = Boolean(rescanLoading[d.id]);
                      const delta =
                        rescanDeltas[d.id] ??
                        (d.recentScores && d.recentScores.length >= 2
                          ? d.recentScores[0]! - d.recentScores[1]!
                          : null);

                      return (
                        <div
                          className="app-card"
                          key={d.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            setUrl(d.hostname);
                            updateFilter("app", d.hostname);
                            nav("history");
                          }}
                        >
                          <div className="app-card-top-row">
                            <div>
                              <span>{d.hostname.slice(0, 2).toUpperCase()}</span>
                              <i
                                className={`status-dot ${
                                  isVerifiedActive ? "verified" : isExpired ? "expired" : "pending"
                                }`}
                              />
                            </div>
                            <button
                              type="button"
                              className="app-card-remove-btn"
                              title={`Remove ${d.hostname}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                promptDeleteDomain(d.id, d.hostname);
                              }}
                              aria-label={`Remove ${d.hostname}`}
                            >
                              <MaterialIcon>delete</MaterialIcon>
                            </button>
                          </div>
                          <MicroLabel>
                            {isVerifiedActive
                              ? "VERIFIED DOMAIN"
                              : isExpired
                                ? "VERIFICATION EXPIRED"
                                : "PENDING VERIFICATION"}
                          </MicroLabel>
                          <h3>{d.hostname}</h3>
                          <code>{d.scanCount ? `${d.scanCount} scan${d.scanCount > 1 ? "s" : ""} recorded` : "No scans yet"}</code>
                          <footer>
                            <div className="app-card-score-col">
                              <span className="app-card-score-text">
                                {d.latestScore !== null && d.latestScore !== undefined ? (
                                  <>
                                    Score: <b>{d.latestScore}/100</b>
                                    {delta !== null && (
                                      <span
                                        className={`score-delta ${delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral"}`}
                                        title={`Score change: ${delta > 0 ? `+${delta}` : delta} vs prior scan`}
                                      >
                                        {delta > 0 ? `+${delta}` : delta}
                                      </span>
                                    )}
                                  </>
                                ) : isVerifiedActive ? (
                                  "Verified — Ready to scan"
                                ) : isExpired ? (
                                  "Verification expired"
                                ) : (
                                  "Pending verification"
                                )}
                              </span>
                            </div>
                            <div className="app-card-btn-wrap" onClick={(e) => e.stopPropagation()}>
                              {isVerifiedActive ? (
                                <button
                                  className="button rescan-button"
                                  disabled={isRunning}
                                  onClick={() => handleRescanApp(d)}
                                  title={isRunning ? "A scan for this app is currently running" : "Start a rescan using last settings"}
                                >
                                  {isRescanning ? (
                                    <>Starting...</>
                                  ) : (
                                    <>
                                      <MaterialIcon>refresh</MaterialIcon> Rescan
                                    </>
                                  )}
                                </button>
                              ) : isExpired ? (
                                <button
                                  className="button reverify-button"
                                  title="Verification expired, prove ownership again"
                                  onClick={() => {
                                    setUrl(d.hostname);
                                    nav("verify");
                                  }}
                                >
                                  Re-verify
                                </button>
                              ) : (
                                <button
                                  className="button verify-button"
                                  onClick={() => {
                                    setUrl(d.hostname);
                                    nav("verify");
                                  }}
                                >
                                  Verify
                                </button>
                              )}
                            </div>
                          </footer>
                          {rateLimitErrors[d.id] && (
                            <div className="app-card-rate-limit" onClick={(e) => e.stopPropagation()}>
                              <MaterialIcon>timer</MaterialIcon>
                              <span>{rateLimitErrors[d.id]}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            {screen === "settings" && (
              <section className="app-screen">
                <div className="app-page-title">
                  <MicroLabel>WORKSPACE / SETTINGS</MicroLabel>
                  <h1>Settings.</h1>
                </div>
                <div className="settings-list">
                  <section>
                    <div>
                      <h3>Profile</h3>
                      <p>Your account details.</p>
                    </div>
                    <div className="settings-fields">
                      <label>
                        NAME
                        <input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Your Name"
                        />
                      </label>
                      <label>
                        EMAIL
                        <input
                          value={userEmail}
                          disabled
                          readOnly
                          className="input-disabled"
                          title="Account email address cannot be modified"
                        />
                        <span className="field-helper-muted">Email address cannot be changed</span>
                      </label>
                      <button className="button" onClick={handleSaveProfile}>
                        Save profile
                      </button>
                    </div>
                  </section>
                  <section>
                    <div>
                      <h3>Verified domains ({domains.length})</h3>
                      <p>Domains approved for scanning.</p>
                    </div>
                    {domains.length === 0 ? (
                      <p className="field-helper">No domains registered yet. Start a new scan to add your app.</p>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        {domains.map((d) => (
                          <div className="domain-row" key={d.id}>
                            <div className="domain-row-info">
                              <i style={{ background: d.status === "verified" ? "var(--passed)" : "#d97706" }} />
                              <span className="domain-hostname">{d.hostname}</span>
                              <small className={d.status === "verified" ? "" : "pending"}>
                                {d.status === "verified" ? "VERIFIED" : "PENDING"}
                              </small>
                            </div>
                            <div className="domain-actions">
                              {d.status === "verified" ? (
                                <button
                                  type="button"
                                  className="action-scan"
                                  onClick={() => {
                                    setUrl(d.hostname);
                                    nav("new");
                                  }}
                                >
                                  Scan
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="action-verify"
                                  onClick={() => {
                                    setUrl(d.hostname);
                                    nav("verify");
                                  }}
                                >
                                  Verify
                                </button>
                              )}
                              <button
                                type="button"
                                className="action-delete"
                                onClick={() => promptDeleteDomain(d.id, d.hostname)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  <section>
                    <div>
                      <h3>Notifications</h3>
                      <p>Choose what reaches your inbox.</p>
                    </div>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEmailNotifications(checked);
                          showToast(
                            checked
                              ? "Email notifications enabled: Scan completion reports will be sent to your inbox."
                              : "Email notifications disabled: No emails will be sent for completed scans.",
                            "info"
                          );
                        }}
                      />
                      Email me when a scan finishes
                    </label>
                  </section>
                  <section className="danger-zone">
                    <div>
                      <h3>Danger zone</h3>
                      <p>Permanently delete your account, registered apps, and all scan records.</p>
                    </div>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={promptDeleteAccount}
                    >
                      Delete account
                    </button>
                  </section>
                </div>
              </section>
            )}
          </div>
        </div>
        </main>
      </div>
      {selected && <FindingDrawer finding={selected} onClose={() => setSelected(null)} onStatus={updateStatus} />}
      {!isOverlayOpen && <Companion message={companionMessage} />}
      {legalDocument && <LegalModal document={legalDocument} onClose={() => setLegalDocument(null)} />}

      {/* Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item toast-${t.type}`} role="alert">
              <div className="toast-icon">
                <MaterialIcon>
                  {t.type === "success" ? "check_circle" : t.type === "error" ? "error" : "info"}
                </MaterialIcon>
              </div>
              <div className="toast-content">{t.message}</div>
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
              >
                <MaterialIcon>close</MaterialIcon>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Clean Custom Confirmation Modal (No browser native alert/confirm) */}
      {confirmModal && confirmModal.isOpen && (
        <div
          className="confirm-modal-scrim"
          onClick={() => !confirmModal.isLoading && setConfirmModal(null)}
        >
          <div
            className="confirm-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="confirm-modal-header">
              <div className={`confirm-modal-icon ${confirmModal.danger ? "" : "icon-info"}`}>
                <MaterialIcon>warning</MaterialIcon>
              </div>
              <div>
                <h3>{confirmModal.title}</h3>
                <p>{confirmModal.description}</p>
              </div>
            </div>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="button"
                disabled={confirmModal.isLoading}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`button ${confirmModal.danger ? "button-danger" : "primary"}`}
                disabled={confirmModal.isLoading}
                onClick={async () => {
                  setConfirmModal((prev) => (prev ? { ...prev, isLoading: true } : null));
                  await confirmModal.onConfirm();
                }}
              >
                {confirmModal.isLoading ? "Processing..." : confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
