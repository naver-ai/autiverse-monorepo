# Autiverse Monorepo

A tablet app that elicits autistic adolescents' daily narratives through AI-guided multimodal journaling. [[CHI 2026 Paper](https://doi.org/10.1145/3772318.3791381)]

Project website: https://naver-ai.github.io/autiverse

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python 3.12, FastAPI, SQLite / PostgreSQL |
| Admin Web | React 19, Vite, Ant Design, TanStack Router |
| Mobile | React Native 0.79, Expo SDK 53 (landscape tablet) |
| Shared | `libs/ts-core` — TypeScript types, i18n, network utilities |
| Infra | Redis (WebSocket), Nx 21 (monorepo orchestration) |

For a detailed architecture overview, see **[docs/architecture.md](docs/architecture.md)**.

## Project Structure

```
apps/
  ├── backend/      # FastAPI Python backend (port 3000)
  ├── admin-web/    # React + Vite admin dashboard (port 8888)
  └── mobile/       # React Native Expo mobile app
libs/
  └── ts-core/      # Shared TypeScript utilities
data/
  └── i18n/         # Translation files (en.json, kr.json)
```

## Prerequisites

- **Python 3.12** — Install via [Pyenv](https://github.com/pyenv/pyenv)
  ```bash
  pyenv install 3.12
  pyenv global 3.12
  ```
- **Node.js LTS** — Install via [NVM](https://github.com/nvm-sh/nvm)
  ```bash
  nvm install --lts
  ```
- **Poetry** — [Install Poetry](https://python-poetry.org/docs/#installing-with-the-official-installer)
  ```bash
  curl -sSL https://install.python-poetry.org | python3 -
  ```
- **Nx** — Install globally
  ```bash
  npm i -g nx
  ```
- **Redis** — Required for WebSocket support
  - macOS: `brew install redis && brew services start redis`
  - Ubuntu: Follow [Redis installation guide](https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/install-redis-on-linux/)
- **PostgreSQL** *(optional, SQLite is the default)* — See [Database Configuration](#database-configuration)

## Getting Started

```bash
# 1. Install dependencies (also installs Python deps via postinstall)
npm install

# 2. Run interactive setup (configures API keys, database, auth)
npm run setup

# 3. Start development servers (backend + admin web)
npm run dev
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run backend + admin-web concurrently |
| `nx run backend:run-dev` | Backend only (port 3000) |
| `nx serve admin-web` | Admin web only (port 8888) |
| `nx run-ios mobile` | Mobile app on iOS simulator |
| `nx run-android mobile` | Mobile app on Android emulator |
| `nx run backend:test_langchain` | Run LangChain tests |
| `nx run backend:reset-db` | Reset the database |
| `nx run backend:dump-data` | Backup database |
| `nx run backend:restore-data` | Restore database from backup |

## Internationalization (i18n)

Autiverse supports **Korean** and **English**. Language is determined per Dyad (child-caregiver pair) via the `dyad.locale` field — set when creating a Dyad in the admin panel. The mobile app automatically syncs the UI language from the Dyad profile.

Translation files: `data/i18n/kr.json` (Korean), `data/i18n/en.json` (English).

For details on the language switching flow, backend usage, and translation editing, see **[docs/i18n.md](docs/i18n.md)**.

## Expo / EAS Build

### Setup

```bash
npm install -g eas-cli
eas login
```

### Build Profiles

Defined in `apps/mobile/eas.json`:

| Profile | Purpose | Distribution |
|---------|---------|-------------|
| `development` | Dev client with Expo dev tools | Internal |
| `preview` | Testing (iOS simulator + Android APK) | Internal |
| `production` | Release build (Android APK, auto-increment version) | Store |

### Build Commands

```bash
cd apps/mobile

# Development build
eas build --profile development --platform android

# Preview build (iOS simulator)
eas build --profile preview --platform ios

# Production build
eas build --profile production --platform android
```

### App Configuration

Key settings in `apps/mobile/app.json`:
- **Bundle ID**: `com.naver.ai.autiverse`
- **Orientation**: Landscape
- **Expo SDK**: 53
- **Permissions**: `RECORD_AUDIO` (for speech recognition)

> The mobile app requires `EXPO_PUBLIC_*` environment variables — these are configured automatically by `npm run setup`.

## Environment Variables

`npm run setup` generates a `.env` file at the project root and copies it to `apps/backend/.env` and `apps/mobile/.env`.

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_PORT` | Backend server port | `3000` |
| `BACKEND_HOSTNAME` | Backend hostname | `0.0.0.0` |
| `AUTH_SECRET` | JWT signing secret | — |
| `OPENAI_API_KEY` | OpenAI API key (required) | — |
| `CLOVA_CLIENT_ID` | Naver Clova TTS client ID | — |
| `CLOVA_CLIENT_SECRET` | Naver Clova TTS client secret | — |
| `DATABASE_TYPE` | `sqlite` or `postgres` | `sqlite` |
| `POSTGRES_DB_NAME` | PostgreSQL database name | `autiversedb` |
| `POSTGRES_USER` | PostgreSQL user | `autiverse` |
| `POSTGRES_PASSWORD` | PostgreSQL password | — |
| `USE_HTTPS` | Enable HTTPS (`1` / `0`) | `0` |

The setup script automatically creates `VITE_` and `EXPO_PUBLIC_` prefixed copies for client-side access.

## Database Configuration

SQLite is the default and requires no additional setup. If you selected PostgreSQL during `npm run setup`:

### macOS

```bash
brew install postgresql
brew services start postgresql
```

### Ubuntu

```bash
sudo apt install postgresql postgresql-contrib
```

On Ubuntu, PostgreSQL uses peer authentication by default — the PostgreSQL role must match your system username:

```bash
sudo -u postgres psql

psql> CREATE ROLE your_username WITH LOGIN;
psql> ALTER ROLE your_username WITH SUPERUSER;
psql> \q
```

## Code Contributors
- Migyeong Yang (NAVER AI Lab) https://yangmigyeong.github.io
- Young-Ho Kim (NAVER AI Lab) https://younghokim.net

## Research Team
- Migyeong Yang (NAVER AI Lab)
- Kyungah Lee (Dodakim Child Development Center)
- Jinyoung Han (Sungkyunkwan University)
- SoHyun Park (NAVER Cloud)
- Young-Ho Kim (NAVER AI Lab) *Corresponding author


## Citing Autiverse

If you use Autiverse in your research, please cite our CHI 2026 paper:

> Migyeong Yang, Kyungah Lee, Jinyoung Han, SoHyun Park, and Young-Ho Kim. 2026. **Autiverse: Eliciting Autistic Adolescents' Daily Narratives through AI-guided Multimodal Journaling.** In *CHI Conference on Human Factors in Computing Systems (CHI '26)*. https://doi.org/10.1145/3772318.3791381

```bibtex
@inproceedings{yang2026autiverse,
  title={Autiverse: Eliciting Autistic Adolescents' Daily Narratives through AI-guided Multimodal Journaling},
  author={Migyeong Yang and Kyungah Lee and Jinyoung Han and SoHyun Park and Young-Ho Kim},
  year={2026},
  publisher={Association for Computing Machinery},
  address={New York, NY, USA},
  url={https://doi.org/10.1145/3772318.3791381},
  doi={10.1145/3772318.3791381},
  booktitle={Proceedings of the 2026 CHI Conference on Human Factors in Computing Systems},
  location={Barcelona, Spain},
  series={CHI '26}
}
```

## License

MIT
