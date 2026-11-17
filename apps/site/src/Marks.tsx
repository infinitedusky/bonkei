import { useId } from 'react'

// The site's marks, drawn by hand as vector (sketches/brand-logo.html); apps/site/public/favicon.svg is SmallMark as a file.
// Logo: a bonsai before a rock mountain with a gold peak, on a lattice bowl, in ink and flat washes.
// It turns to mud below 32 px, so the favicon and tab use SmallMark: the same picture simplified,
// in the same colours, centred on a paper tile. SmallMark is used sparingly, only where Logo cannot go.

export function Logo({ size = 48, title = 'Bonkei' }: { size?: number; title?: string }) {
  const id = useId().replace(/:/g, '') + 'hishi'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      <defs><pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#f4efe3"/>
        <path d="M5 1.2 L8.8 5 L5 8.8 L1.2 5 Z" fill="#24508F"/>
      </pattern></defs>
      <path d="M24 38 L33 17 L38 23.5 L44 10 L52 29 L55 26.5 L58 38 Z" fill="#8C7E6E" stroke="#2A2622" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M40.6 16 L44 10 L47 16.8 Z" fill="#C9A24A" stroke="#2A2622" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M19.8 30.4 Q17.2 30.2 14.4 31.4" fill="none" stroke="#2A2622" strokeWidth="2.6" strokeLinecap="round"/>
        <path d="M16.8 38.2 C14.4 33.8 20.4 31.8 19.2 28.2 C18.4 25.4 20.8 22.6 24.8 21.4 L26.6 23.6 C23.6 25 22.8 27 23.6 29 C24.8 32.6 22.4 35.4 25.2 38.2 Z" fill="#6b5544" stroke="#2A2622" strokeWidth="1.4" strokeLinejoin="round"/>
        <g fill="#3F6B4E" stroke="#2A2622" strokeWidth="1.3" strokeLinejoin="round"><path d="M6.8 32.2 Q6.6 29.12 9.46 28 Q11.24 25.76 14.5 26.6 Q17.46 25.48 20.12 28 Q21.8 30.24 21.6 32.2 Q14.2 33.21 6.8 32.2 Z"/><path d="M22.8 26.2 Q22.6 22.9 25.75 21.7 Q27.72 19.3 31.33 20.2 Q34.61 19 37.56 21.7 Q39.4 24.1 39.2 26.2 Q31 27.28 22.8 26.2 Z"/><path d="M14.8 19.8 Q14.6 16.5 17.39 15.3 Q19.12 12.9 22.29 13.8 Q25.17 12.6 27.76 15.3 Q29.4 17.7 29.2 19.8 Q22 20.88 14.8 19.8 Z"/></g>
        <ellipse cx="32" cy="38.5" rx="25" ry="4" fill="#E6DCC3" stroke="#2A2622" strokeWidth="1.6"/>
        <path d="M7 38.5 Q8 52 18 53 H46 Q56 52 57 38.5 Q50 42.5 32 42.5 Q14 42.5 7 38.5 Z" fill={`url(#${id})`} stroke="#2A2622" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  )
}

export function SmallMark({ size = 32, title = 'Bonkei' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title}>
      <rect x="2.4" y="2.4" width="27.2" height="27.2" rx="5" fill="#EFE6D0" stroke="#2A2622" strokeWidth="1.4"/>
      <g transform="translate(16 16) scale(.83) translate(-16.39 -16.3)">
        <path d="M13.4 20.4 L18.6 10.6 L20.8 13.4 L23.8 7.4 L28.4 20.4 Z" fill="#8C7E6E" stroke="#2A2622" strokeWidth=".9" strokeLinejoin="round"/>
        <path d="M22.3 10.4 L23.8 7.4 L25.2 10.6 Z" fill="#C9A24A" stroke="#2A2622" strokeWidth=".6" strokeLinejoin="round"/>
        <path d="M10.9 16.7 Q9.6 16.6 8.2 17.2" fill="none" stroke="#2A2622" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9.4 20.6 C8.2 18.4 11.2 17.4 10.6 15.6 C10.2 14.2 11.4 12.8 13.4 12.2 L14.3 13.3 C12.8 14 12.4 15 12.8 16 C13.4 17.8 12.2 19.2 13.6 20.6 Z" fill="#6b5544" stroke="#2A2622" strokeWidth=".8" strokeLinejoin="round"/>
        <g fill="#3F6B4E" stroke="#2A2622" strokeWidth=".8" strokeLinejoin="round"><path d="M4.4 17.6 Q4.2 16.06 5.73 15.5 Q6.62 14.38 8.25 14.8 Q9.73 14.24 11.06 15.5 Q12 16.62 11.8 17.6 Q8.1 18.1 4.4 17.6 Z"/><path d="M12.4 14.6 Q12.2 12.95 13.88 12.35 Q14.86 11.15 16.66 11.6 Q18.3 11 19.78 12.35 Q20.8 13.55 20.6 14.6 Q16.5 15.14 12.4 14.6 Z"/><path d="M8.4 11.4 Q8.2 9.75 9.7 9.15 Q10.56 7.95 12.14 8.4 Q13.58 7.8 14.88 9.15 Q15.8 10.35 15.6 11.4 Q12 11.94 8.4 11.4 Z"/></g>
        <path d="M5.6 20.8 H26.4 L23.8 25.2 H8.2 Z" fill="#24508F" stroke="#2A2622" strokeWidth=".9" strokeLinejoin="round"/>
        <g fill="#f4efe3"><path d="M10 23 l1 -1 l1 1 l-1 1z"/><path d="M15 23 l1 -1 l1 1 l-1 1z"/><path d="M20 23 l1 -1 l1 1 l-1 1z"/></g>
      </g>
    </svg>
  )
}
