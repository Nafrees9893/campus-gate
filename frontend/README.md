# Campus Gate frontend

The supplied `dist/` folder contains the complete React SPA, fonts and third-party notices. Start the Python server from the project root as explained in the main README. The server serves the API and this frontend on the same origin. All screens work without an external font service, asset CDN or separate frontend development server.

## Rebuild after editing

Install Node.js 18 or later and run these commands inside `frontend/`:

```sh
npm ci
npm run build
```

The first command downloads the pinned packages. The second builds `src/main.jsx`, copies styles and fonts, and updates `dist/`. Refresh the running app after rebuilding. If the server was started before the first build, restart it.

The frontend displays timestamps in Asia/Colombo time. Hash routes support navigation, bookmarks and browser history without server rewrites. Daily and monthly reports use the same authenticated REST endpoints as CSV downloads. The browser sends an HTTP-only session cookie automatically.
