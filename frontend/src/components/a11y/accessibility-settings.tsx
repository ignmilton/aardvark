'use client';

import { useState, useEffect } from 'react';
import { Settings, Type, Contrast, MonitorSmartphone } from 'lucide-react';

type FontSize = 'small' | 'medium' | 'large' | 'x-large';
type ContrastMode = 'normal' | 'high';

interface A11ySettings {
  fontSize: FontSize;
  contrastMode: ContrastMode;
  reducedMotion: boolean;
  lineSpacing: 'normal' | 'relaxed' | 'loose';
}

const DEFAULT_SETTINGS: A11ySettings = {
  fontSize: 'medium',
  contrastMode: 'normal',
  reducedMotion: false,
  lineSpacing: 'normal',
};

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
  'x-large': '20px',
};

const LINE_SPACING_MAP: Record<string, string> = {
  normal: '1.6',
  relaxed: '1.8',
  loose: '2.0',
};

/**
 * Accessibility settings panel for customizing reading experience.
 * Supports font size, contrast, reduced motion, and line spacing.
 */
export function AccessibilitySettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('a11y-settings');
    if (stored) {
      const parsed = JSON.parse(stored) as A11ySettings;
      setSettings(parsed);
      applySettings(parsed);
    }

    // Respect system preference for reduced motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      updateSetting('reducedMotion', true);
    }
  }, []);

  const applySettings = (s: A11ySettings) => {
    const root = document.documentElement;
    root.style.setProperty('--reading-font-size', FONT_SIZE_MAP[s.fontSize]);
    root.style.setProperty('--reading-line-height', LINE_SPACING_MAP[s.lineSpacing]);

    if (s.contrastMode === 'high') {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (s.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  };

  const updateSetting = <K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    localStorage.setItem('a11y-settings', JSON.stringify(updated));
    applySettings(updated);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md p-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label="Accessibility settings"
        aria-expanded={isOpen}
        aria-controls="a11y-panel"
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Accessibility</span>
      </button>

      {isOpen && (
        <div
          id="a11y-panel"
          role="dialog"
          aria-label="Accessibility settings"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border bg-card p-4 shadow-lg"
        >
          <h3 className="mb-4 text-sm font-semibold">Reading Preferences</h3>

          {/* Font Size */}
          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Type className="h-3.5 w-3.5" />
              Text Size
            </label>
            <div className="flex gap-1" role="radiogroup" aria-label="Text size">
              {(['small', 'medium', 'large', 'x-large'] as FontSize[]).map((size) => (
                <button
                  key={size}
                  role="radio"
                  aria-checked={settings.fontSize === size}
                  onClick={() => updateSetting('fontSize', size)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs capitalize ${
                    settings.fontSize === size
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {size === 'x-large' ? 'XL' : size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Line Spacing */}
          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MonitorSmartphone className="h-3.5 w-3.5" />
              Line Spacing
            </label>
            <div className="flex gap-1" role="radiogroup" aria-label="Line spacing">
              {(['normal', 'relaxed', 'loose'] as const).map((spacing) => (
                <button
                  key={spacing}
                  role="radio"
                  aria-checked={settings.lineSpacing === spacing}
                  onClick={() => updateSetting('lineSpacing', spacing)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs capitalize ${
                    settings.lineSpacing === spacing
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {spacing}
                </button>
              ))}
            </div>
          </div>

          {/* High Contrast */}
          <div className="mb-3 flex items-center justify-between">
            <label
              htmlFor="high-contrast"
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
            >
              <Contrast className="h-3.5 w-3.5" />
              High Contrast
            </label>
            <button
              id="high-contrast"
              role="switch"
              aria-checked={settings.contrastMode === 'high'}
              onClick={() =>
                updateSetting('contrastMode', settings.contrastMode === 'high' ? 'normal' : 'high')
              }
              className={`relative h-5 w-9 rounded-full transition-colors ${
                settings.contrastMode === 'high' ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  settings.contrastMode === 'high' ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Reduced Motion */}
          <div className="flex items-center justify-between">
            <label
              htmlFor="reduced-motion"
              className="text-xs font-medium text-muted-foreground"
            >
              Reduced Motion
            </label>
            <button
              id="reduced-motion"
              role="switch"
              aria-checked={settings.reducedMotion}
              onClick={() => updateSetting('reducedMotion', !settings.reducedMotion)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                settings.reducedMotion ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  settings.reducedMotion ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
