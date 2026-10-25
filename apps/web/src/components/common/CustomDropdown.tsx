import { useEffect, useRef, useState, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "./MaterialIcon";

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

export interface CustomDropdownProps<T = string> {
  id?: string;
  label?: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function CustomDropdown<T extends string = string>({
  id: propId,
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
  className = "",
  ariaLabel,
  disabled = false,
}: CustomDropdownProps<T>) {
  const generatedId = useId();
  const listboxId = propId || `dropdown-${generatedId}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    placeAbove: false,
  });

  const [highlightBarStyle, setHighlightBarStyle] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0,
    height: 0,
    visible: false,
  });

  const typeaheadBuffer = useRef("");
  const typeaheadTimer = useRef<number | null>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedOption = options[selectedIndex];

  // Update floating portal position anchored at trigger
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(options.length * 42 + 16, 320);
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setCoords({
      top: placeAbove ? rect.top + window.scrollY - 6 : rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 180),
      placeAbove,
    });
  }, [options.length]);

  const openDropdown = () => {
    if (disabled) return;
    updateCoords();
    setIsOpen(true);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    setHighlightBarStyle((prev) => ({ ...prev, visible: false }));
  };

  // Recalculate on scroll / resize while open
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();
    const handleScrollOrResize = () => updateCoords();
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updateCoords]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        listboxRef.current &&
        !listboxRef.current.contains(target)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  // Gliding highlight bar calculation
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listboxRef.current) {
      setHighlightBarStyle((prev) => ({ ...prev, visible: false }));
      return;
    }
    const optionElements = listboxRef.current.querySelectorAll<HTMLElement>("[role='option']");
    const targetElement = optionElements[highlightedIndex];
    if (targetElement) {
      setHighlightBarStyle({
        top: targetElement.offsetTop,
        height: targetElement.offsetHeight,
        visible: true,
      });
      // Scroll into view if needed
      targetElement.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, highlightedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
        break;

      case "ArrowDown": {
        e.preventDefault();
        let nextIndex = highlightedIndex + 1;
        while (nextIndex < options.length && options[nextIndex]?.disabled) {
          nextIndex++;
        }
        if (nextIndex < options.length) {
          setHighlightedIndex(nextIndex);
        }
        break;
      }

      case "ArrowUp": {
        e.preventDefault();
        let prevIndex = highlightedIndex - 1;
        while (prevIndex >= 0 && options[prevIndex]?.disabled) {
          prevIndex--;
        }
        if (prevIndex >= 0) {
          setHighlightedIndex(prevIndex);
        }
        break;
      }

      case "Home": {
        e.preventDefault();
        const first = options.findIndex((o) => !o.disabled);
        if (first >= 0) setHighlightedIndex(first);
        break;
      }

      case "End": {
        e.preventDefault();
        for (let i = options.length - 1; i >= 0; i--) {
          if (!options[i]?.disabled) {
            setHighlightedIndex(i);
            break;
          }
        }
        break;
      }

      case "Enter":
      case " ": {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          const opt = options[highlightedIndex];
          if (opt && !opt.disabled) {
            onChange(opt.value);
            closeDropdown();
            triggerRef.current?.focus();
          }
        }
        break;
      }

      default: {
        // Type-ahead support
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (typeaheadTimer.current) window.clearTimeout(typeaheadTimer.current);
          typeaheadBuffer.current += e.key.toLowerCase();
          typeaheadTimer.current = window.setTimeout(() => {
            typeaheadBuffer.current = "";
          }, 600);

          const matchIndex = options.findIndex(
            (o) => !o.disabled && o.label.toLowerCase().startsWith(typeaheadBuffer.current)
          );
          if (matchIndex >= 0) {
            setHighlightedIndex(matchIndex);
          }
        }
        break;
      }
    }
  };

  const currentOptionId =
    isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined;

  return (
    <div className={`custom-dropdown-root ${className}`}>
      {label && <label className="custom-dropdown-label">{label}</label>}
      <button
        type="button"
        ref={triggerRef}
        id={listboxId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${listboxId}-menu`}
        aria-activedescendant={currentOptionId}
        aria-label={ariaLabel || label || placeholder}
        disabled={disabled}
        className={`custom-dropdown-trigger ${isOpen ? "is-open" : ""}`}
        onClick={() => {
          if (isOpen) closeDropdown();
          else openDropdown();
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="custom-dropdown-trigger-text">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`custom-dropdown-chevron ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">
          <MaterialIcon>expand_more</MaterialIcon>
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={listboxRef}
            id={`${listboxId}-menu`}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={listboxId}
            className={`custom-dropdown-panel ${coords.placeAbove ? "place-above" : "place-below"}`}
            style={{
              position: "absolute",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              minWidth: `${coords.width}px`,
              zIndex: 9999,
              transformOrigin: coords.placeAbove ? "bottom left" : "top left",
            }}
          >
            {/* Gliding highlight bar */}
            {highlightBarStyle.visible && (
              <div
                className="custom-dropdown-highlight-bar"
                style={{
                  top: `${highlightBarStyle.top}px`,
                  height: `${highlightBarStyle.height}px`,
                }}
                aria-hidden="true"
              />
            )}

            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;
              const optionId = `${listboxId}-option-${idx}`;

              return (
                <div
                  key={String(opt.value)}
                  id={optionId}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  style={
                    {
                      "--option-index": idx,
                    } as React.CSSProperties
                  }
                  className={`custom-dropdown-option ${isSelected ? "is-selected" : ""} ${
                    isHighlighted ? "is-highlighted" : ""
                  } ${opt.disabled ? "is-disabled" : ""}`}
                  onMouseEnter={() => {
                    if (!opt.disabled) setHighlightedIndex(idx);
                  }}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    closeDropdown();
                    triggerRef.current?.focus();
                  }}
                >
                  <span className="custom-dropdown-option-label">
                    {opt.label}
                    {opt.sublabel && (
                      <small className="custom-dropdown-option-sublabel">{opt.sublabel}</small>
                    )}
                  </span>
                  {opt.badge && <span className="custom-dropdown-option-badge">{opt.badge}</span>}
                  {isSelected && (
                    <span className="custom-dropdown-check" aria-hidden="true">
                      <MaterialIcon>check</MaterialIcon>
                    </span>
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
