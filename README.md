# Lafrista Fashion & Design

Lafrista is a responsive custom-clothing studio website built with plain HTML, CSS, and a small amount of JavaScript. It introduces the studio's made-to-measure clothing for men and women, explains the design process, and lets visitors prepare an enquiry. Keyboard users can skip directly to the main content, and interactive controls have visible focus states.

## Run locally

Open `index.html` in a browser to view the public website. The stock dashboard is a separate, local-only tool in the business workspace; its files are intentionally excluded from this public repository.

The public enquiry form validates the visitor's details and opens a prefilled email draft to `hello@lafrista.com`; it does not send or store enquiries. Fashion product photography is loaded from Unsplash. The owner portraits are stored in `images/`.

## Publish with GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the public site when changes reach the `main` branch. It copies only `index.html`, `styles.css`, and `images/` into the Pages artifact. The local stock dashboard is excluded from both the public repository and the published site.

To turn on publishing, push the site changes to `main`, then in the GitHub repository open **Settings → Pages** and set the build and deployment source to **GitHub Actions**. The first successful workflow run publishes the site at `https://omondistephen397-oss.github.io/Lafrista/`. The owner photos in `images/` will be public on that site.

## Design system

The shared visual foundations live at the top of `styles.css` in `:root`: color, typography, spacing, and content-width tokens. Reusable patterns include the announcement bar, navigation, buttons, text links, service cards, section headings, form controls, and responsive page layouts. Use those tokens and patterns when adding pages so the studio website stays visually consistent.
