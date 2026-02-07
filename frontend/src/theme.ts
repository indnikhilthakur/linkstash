// Theme tokens from design guidelines
export const colors = {
  background: '#09090B',
  surface: '#18181B',
  surfaceHighlight: '#27272A',
  border: '#3F3F46',
  primary: '#CCFF00',
  primaryForeground: '#000000',
  secondary: '#7C3AED',
  secondaryForeground: '#FFFFFF',
  text: {
    heading: '#FFFFFF',
    body: '#A1A1AA',
    muted: '#52525B',
  },
  status: {
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    aiProcessing: '#06B6D4',
  },
  overlay: 'rgba(0,0,0,0.85)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const platformIcons: Record<string, { icon: string; color: string }> = {
  youtube: { icon: 'youtube', color: '#FF0000' },
  instagram: { icon: 'instagram', color: '#E4405F' },
  twitter: { icon: 'twitter', color: '#1DA1F2' },
  tiktok: { icon: 'music', color: '#000000' },
  reddit: { icon: 'message-circle', color: '#FF4500' },
  linkedin: { icon: 'linkedin', color: '#0077B5' },
  github: { icon: 'github', color: '#FFFFFF' },
  medium: { icon: 'book-open', color: '#000000' },
  web: { icon: 'globe', color: '#A1A1AA' },
};
