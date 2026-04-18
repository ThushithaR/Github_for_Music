# GOODWINSUN - Ambient Capture & Version Control

A Next.js application for AI-driven ambient music capture and version control, converted from the original HTML implementation.

## Features

- **Always-listening buffer**: Continuously captures 60 seconds of audio
- **Smart capture**: Save the last 30 seconds with AI analysis
- **Version control**: Branch, merge, and track evolution of musical ideas
- **Semantic search**: Find fragments by mood, key, BPM, tags, and more
- **Evolution map**: Visualize relationships between musical fragments
- **Session timeline**: Track creative progress over time

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
src/
  app/                 # Next.js app directory
    globals.css       # Global styles
    layout.tsx         # Root layout
    page.tsx          # Main page
  components/          # React components
    Sidebar.tsx        # Navigation sidebar
    Topbar.tsx         # Top navigation bar
    VaultView.tsx      # Main vault view
    MapView.tsx        # Evolution map
    SearchView.tsx     # Semantic search
    TimelineView.tsx   # Session timeline
    DetailPanel.tsx    # Clip detail panel
    CaptureModal.tsx   # Capture review modal
    ShortcutsOverlay.tsx # Keyboard shortcuts
    ToastContainer.tsx # Toast notifications
  hooks/               # Custom React hooks
    useGoodwinsun.ts   # Main application hook
  types/               # TypeScript definitions
    index.ts           # Type definitions
  utils/               # Utility functions
    constants.ts       # App constants
    helpers.ts         # Helper functions
```

## Usage

### Keyboard Shortcuts

- **C** - Capture the last 30 seconds
- **/** - Focus search bar
- **ESC** - Close panels / cancel actions
- **?** - Toggle shortcuts panel

### Views

1. **The Vault** - Main view for browsing and managing fragments
2. **Evolution Map** - Visual representation of fragment relationships
3. **Semantic Search** - Search fragments by various attributes
4. **Session Timeline** - Chronological view of creative sessions

### Fragment Types

- **Root** - Original captured ideas
- **Branch** - Variations of existing fragments
- **Merge** - Combinations of multiple fragments
- **Version** - Iterations of fragments

## Data Persistence

The application uses localStorage to persist:
- Captured fragments
- User preferences
- Session state

## Development

### Adding New Features

1. Define types in `src/types/index.ts`
2. Add constants to `src/utils/constants.ts`
3. Implement logic in `src/hooks/useGoodwinsun.ts`
4. Create components in `src/components/`
5. Add styles to `src/app/globals.css`

### Styling

The application uses CSS custom properties for theming. Key variables are defined in `:root`:

- `--bg-*` - Background colors
- `--text-*` - Text colors
- `--amber` - Primary accent color
- `--font-*` - Font families

## Original Conversion

This application was converted from a single HTML file with embedded CSS and JavaScript to a modern Next.js application with:

- React components with TypeScript
- Custom hooks for state management
- Modular CSS organization
- Component-based architecture
- Type safety throughout

## License

This project maintains the same license as the original GOODWINSUN application.
