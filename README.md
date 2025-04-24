# Steam Vault

Steam Vault is an open-source project that combines a Svelte-based frontend with a modular backend. It includes several packages:

- **site** – a SvelteKit UI for the website,
- **lib** – shared functionality and APIs (database, models, repositories, etc.),
- **worker** – Cloudflare worker configuration for server-side tasks.

## Overview

This project is built to deliver a responsive, full-stack application leveraging modern web technologies including SvelteKit, Cloudflare Workers, and Drizzle ORM. It is organized as a multi-package repo so you can work on frontend, API, and worker tasks independently.

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm (or your favorite package manager like pnpm or yarn)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/colecrouter/rarest-achievement.git
cd rarest-achievement
npm install
```

### Development

To start the development server for the site package:

```bash
npm run dev
```

This will run the SvelteKit application. Additional commands are available in each package (i.e. the worker and lib packages) for testing and building.

### Building

To create a production version of the site:

```bash
npm run build
```

Preview with:

```bash
npm run preview
```

## Project Structure

- **/packages/site**: Contains the SvelteKit frontend.
- **/packages/lib**: Shared logic including APIs, models, and database repositories.
- **/packages/worker**: Cloudflare Worker configuration and runtime types.

## Contributing

Contributions are welcome! Please follow these simple steps:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes with clear messages.
4. Open a pull request detailing your changes.

## License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.