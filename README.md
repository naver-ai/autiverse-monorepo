# Autiverse Monorepo

Monorepo for the Autiverse project.

## Setting Up Environment


### 1. Python Environment Setup

1. Install Pyenv (<https://github.com/pyenv/pyenv>)
2. Install Python 3.12
```bash
pyenv install 3.12
pyenv global 3.12
python --version  # Verify 3.12.x
```
3. Install Poetry (<https://python-poetry.org/docs/#installing-with-the-official-installer>)
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

### 1. Node.js and Nx Setup

1. Install NVM (<https://github.com/nvm-sh/nvm>)
2. Install latest LTS version of Node.js
```bash
nvm install --lts
```
3. Install Nx globally
```bash
npm i -g nx
nx --version  # Verify Nx version
```

4. Install dependencies
```bash
npm install # This will also run nx run backend:install under the hood to install python dependencies.
```


### 3. Run Setup Script

Run initial setup script:
```bash
nx run setup # Prepare OpenAI API Key.
```

## Development Commands

### Test commands
```bash
nx run backend:test_langchain
```

### Backend (Python) - Not Working Yet

Run development server:
```bash
nx run backend:run-dev
```

### Frontend (Web) - Not Working Yet

Run development server:
```bash
nx serve frontend
```

## Project Structure

```
apps/
  ├── backend/     # Python backend
libs/          # Shared libraries
```