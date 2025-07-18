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
npm run setup # Prepare OpenAI API Key.
```


## Database Settings (If selected `Postgresql`)
1. Install Postgresql on the system
- MacOS (Development):
    ```bash
    brew install postgresql
    brew services start postgresql
    ```

- Ubuntu (Production):

    ```bash
    sudo apt install postgresql postgresql-contrib
    ```

    - On Ubuntu, Postgresql by default requires Peer authentication; the role in the Postgresql should be the same as the ubuntu username. Therefore, you should first create a postgresql role with the same name as the ubuntu user and with superuser privilages:

        ```bash
        sudo -u postgres psql # Enter psql shell with default postgres user

        psql> CREATE ROLE your_ubuntu_account_name WITH LOGIN # Replace `your_ubuntu_account_name` into your ubuntu account name that will also run the server.
        psql> ALTER ROLE your_ubuntu_account_name WITH SUPERUSER; # Assign superuser privileges.
        psql> \q #Quit the psql shell.
        ```




## Development Commands

### Test commands
```bash
nx run backend:test_langchain
```

### Backend (Python)

Run development server:
```bash
nx run backend:run-dev
```

Run admin web server:
```bash
nx serve admin-web
```

You can run both in a single terminal tab:
```bash
npm run dev
```

### Mobile App 

Run development mode:
```bash
nx run-ios mobile #iOS
nx run-android mobile #Android
```

## Project Structure

```
apps/
  ├── backend/     # Python backend
libs/          # Shared libraries
```