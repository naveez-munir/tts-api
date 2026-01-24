# Design & Responsiveness Standards

## Design Principles

- ⚠️ **CRITICAL**: Create 100% original design and copywriting
- ⚠️ **DO NOT copy** ots-uk.co.uk design, layout, color scheme, or content (copyright infringement risk)
- ✅ **Use ots-uk.co.uk ONLY as functional reference** (what features they have, how booking flow works)
- ✅ **Create unique branding**: original color palette, typography, logo concept, UI patterns
- ✅ **Professional aesthetic**: trustworthy, modern, clean design appropriate for transport booking
- ✅ **Accessibility**: WCAG 2.1 AA compliance (color contrast, keyboard navigation, screen reader support)

---

## Tailwind CSS Configuration Requirements

### Using Tailwind CSS 4 with `@theme inline` in `globals.css`

**Configuration in `globals.css`:**

```css
@import "tailwindcss";

@theme inline {
  /* Color Palette */
  --color-primary-50: #f0f9ff;
  --color-primary-100: #e0f2fe;
  --color-primary-200: #bae6fd;
  --color-primary-300: #7dd3fc;
  --color-primary-400: #38bdf8;
  --color-primary-500: #0ea5e9;
  --color-primary-600: #0284c7;
  --color-primary-700: #0369a1;
  --color-primary-800: #075985;
  --color-primary-900: #0c4a6e;

  /* Spacing (if custom values needed) */
  --spacing-18: 4.5rem;
  --spacing-22: 5.5rem;

  /* Typography */
  --font-family-display: 'Inter', sans-serif;
  --font-family-body: 'Inter', sans-serif;

  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;

  /* Box Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  /* Breakpoints */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}
```

### Configuration Rules

- ✅ All colors defined in `@theme inline` block - NO hardcoded hex values in components
- ✅ Define color palette with semantic names: primary, secondary, accent, neutral, success, warning, error
- ✅ Each color should have shades: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900
- ✅ All spacing values in `@theme inline` if custom values needed
- ✅ Typography scale (font families, sizes, line heights) in `@theme inline`
- ✅ Border radius values in `@theme inline`
- ✅ Box shadows in `@theme inline`
- ✅ Breakpoints in `@theme inline`
- ✅ Easy theme switching: changing values in `@theme inline` should update entire app

---

## CRITICAL: Global CSS Rules

### ❌ NEVER DO THIS:

```css
/* ❌ INCORRECT - Global element overrides */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
}

a {
  text-decoration: none;
  color: #0ea5e9;
}

button {
  cursor: pointer;
  border: none;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}
```

### ✅ CORRECT APPROACH:

```css
/* ✅ CORRECT - globals.css should ONLY contain */
@import "tailwindcss";

@theme inline {
  /* Theme configuration only */
}
```

### Rules

- ❌ **NEVER add global element styles** (`*`, `html`, `body`, `a`, `button`, etc.) that override Tailwind defaults
- ❌ **NEVER add global resets** like `margin: 0`, `padding: 0` on universal selector
- ❌ **NEVER add custom utility classes** in global CSS (`.container`, `.btn`, etc.) - use Tailwind utilities or create components
- ❌ **NEVER add global styles** that affect spacing, display, positioning, or any CSS properties Tailwind controls
- ✅ **ONLY use `globals.css` for**: `@import "tailwindcss"` and `@theme inline` configuration block
- ✅ **Component-specific styles**: Create styled components or use Tailwind utilities in className
- ✅ **Follow Tailwind CSS 4 best practices**: Keep global CSS minimal, let Tailwind handle all styling

---

## Responsive Design Requirements

### Mobile-First Approach

- Design for mobile first (320px minimum width), then scale up
- All layouts must work on:
  - iPhone SE (375px)
  - Standard mobile (390px-428px)
  - Tablets (768px-1024px)
  - Desktop (1280px+)
- Test at various viewport heights: 600px, 800px, 1080px, 1440px

### Breakpoint Strategy

- **sm**: 640px (large phones, small tablets)
- **md**: 768px (tablets)
- **lg**: 1024px (small laptops)
- **xl**: 1280px (desktops)
- **2xl**: 1536px (large desktops)

### Responsive Rules

#### ❌ NEVER DO THIS:

```tsx
// ❌ INCORRECT - Hardcoded pixel values
<div className="w-[900px] h-[450px] text-[18px]">
  Content
</div>
```

#### ✅ CORRECT APPROACH:

```tsx
// ✅ CORRECT - Tailwind utility classes with theme values
<div className="w-full max-w-4xl h-auto text-lg">
  Content
</div>

// ✅ CORRECT - Responsive variants
<div className="w-full md:w-1/2 lg:w-1/3">
  Content
</div>
```

### Key Requirements

- ❌ **NEVER use hardcoded pixel values** like `w-[900px]`, `h-[450px]`, `text-[18px]`
- ✅ **ALWAYS use Tailwind utility classes** with theme values: `w-full`, `max-w-4xl`, `h-screen`, `text-lg`
- ✅ **Use responsive variants**: `w-full md:w-1/2 lg:w-1/3`
- ✅ **Flexible layouts**: Use flexbox and grid with responsive classes
- ✅ **Touch-friendly**: Minimum 44px × 44px tap targets on mobile (buttons, links, form inputs)
- ✅ **Readable text**: Minimum 16px base font size on mobile, proper line height (1.5-1.75)
- ✅ **Proper spacing**: Adequate padding and margins that scale with breakpoints

---

## Component Examples

### Button Component

```tsx
// ✅ CORRECT - Responsive button with Tailwind
export function Button({ children, variant = 'primary', size = 'md' }: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}>
      {children}
    </button>
  );
}
```

### Card Component

```tsx
// ✅ CORRECT - Responsive card
export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 md:p-6 lg:p-8 ${className}`}>
      {children}
    </div>
  );
}
```

### Form Input

```tsx
// ✅ CORRECT - Accessible, responsive input
export function Input({ label, error, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        aria-invalid={!!error}
        aria-describedby={error ? `${props.id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${props.id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

#### Color Contrast

- **Normal text (< 18px)**: Minimum 4.5:1 contrast ratio
- **Large text (≥ 18px or 14px bold)**: Minimum 3:1 contrast ratio
- **Interactive elements**: Minimum 3:1 contrast ratio

#### Keyboard Navigation

```tsx
// ✅ CORRECT - Keyboard accessible modal
function Modal({ isOpen, onClose, children }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="bg-white rounded-lg p-6">
        {children}
      </div>
    </div>
  );
}
```

#### ARIA Labels

```tsx
// ✅ CORRECT - Proper ARIA labels
<button
  aria-label="Close modal"
  onClick={onClose}
  className="p-2 hover:bg-gray-100 rounded-full"
>
  <XIcon className="w-5 h-5" aria-hidden="true" />
</button>

// ✅ CORRECT - Form with proper labels
<form>
  <label htmlFor="email" className="block text-sm font-medium">
    Email Address
  </label>
  <input
    id="email"
    type="email"
    name="email"
    aria-required="true"
    aria-describedby="email-hint"
  />
  <p id="email-hint" className="text-sm text-gray-500">
    We'll never share your email
  </p>
</form>
```

#### Focus Styles

```css
/* ✅ CORRECT - Visible focus styles */
.button:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Or with Tailwind */
<button className="focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
  Click me
</button>
```

---

## Performance Best Practices

### Image Optimization

```tsx
// ✅ CORRECT - Next.js Image component
import Image from 'next/image';

<Image
  src="/booking-hero.jpg"
  alt="Airport transfer booking"
  width={1200}
  height={600}
  priority
  className="rounded-lg"
/>
```

### Lazy Loading

```tsx
// ✅ CORRECT - Lazy load non-critical components
import dynamic from 'next/dynamic';

const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), {
  loading: () => <LoadingSpinner />,
});
```

### Font Optimization

```tsx
// ✅ CORRECT - Next.js font optimization
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```
