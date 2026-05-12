import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export const Ic = {
  arrow: (p: IconProps = {}) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  check: (p: IconProps = {}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  doc: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M4 2.5h6l4 4V14a1.5 1.5 0 0 1-1.5 1.5h-8.5A1.5 1.5 0 0 1 2.5 14V4A1.5 1.5 0 0 1 4 2.5z" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10 2.5V6.5h4" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 9h6M5 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  shield: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M9 2L3 4.5v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5v-4L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6.5 9l1.8 1.8L11.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  risk: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <rect x="2.5" y="2.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="10.5" y="2.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="2.5" y="10.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="10.5" y="10.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  audit: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M11.8 11.8l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  kpi: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M2.5 13l4-4 3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.5 5h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  evid: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M3 4.5h4l1.2 1.5H15a.5.5 0 0 1 .5.5V14a.5.5 0 0 1-.5.5H3A.5.5 0 0 1 2.5 14V5a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  capa: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M3 9a6 6 0 0 1 10-4.5M15 9a6 6 0 0 1-10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 2.5v3h-3M5 15.5v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  action: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M9 2.5v13M2.5 9h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  ai: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M9 2.5L10.4 6 14 7.4 10.4 8.8 9 12.5 7.6 8.8 4 7.4 7.6 6 9 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M13.5 12.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6.6-1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  mail: (p: IconProps = {}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}>
      <rect x="1.5" y="3" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M2 4l5 3.5L12 4" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  warn: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M9 2.5L16 14.5H2L9 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M9 7v3.5M9 12.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  clock: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M9 5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  spread: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <rect x="2.5" y="2.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2.5 7h13M2.5 12h13M6 2.5v13M11 2.5v13" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  bell: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <path d="M5 14h8M4.5 11.5h9V8a4.5 4.5 0 0 0-9 0v3.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  spark: (p: IconProps = {}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}>
      <path d="M7 1l1.2 3.6L12 6l-3.8 1.4L7 11 5.8 7.4 2 6l3.8-1.4L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  human: (p: IconProps = {}) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}>
      <circle cx="7" cy="4.5" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M2.5 12.5c.6-2.4 2.4-3.5 4.5-3.5s3.9 1.1 4.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  lock: (p: IconProps = {}) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...p}>
      <rect x="3" y="8" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
};
