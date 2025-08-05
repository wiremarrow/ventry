# Ventry System Prerequisites

## Required Software

### Core Requirements

#### Node.js

- **Version**: 18.0.0 or higher (LTS recommended)
- **Required for**: Running the application, build tools, and development servers
- **Installation**: Download from [nodejs.org](https://nodejs.org/)

#### pnpm

- **Version**: 8.0.0 or higher
- **Required for**: Package management and monorepo workspace handling
- **Installation**: `npm install -g pnpm@8`
- **Note**: This project uses pnpm workspaces for monorepo management

#### Git

- **Version**: Any recent version
- **Required for**: Version control and repository management
- **Installation**: Download from [git-scm.com](https://git-scm.com/)

### Database & Services

#### Docker

- **Required for**: Running PostgreSQL and Redis services
- **Version**: Docker Engine 20.10+ and Docker Compose v2.0+
- **Installation**: Download from [docker.com](https://www.docker.com/)
- **Note**: Required for local development environment

#### PostgreSQL

- **Version**: 16.0 or higher
- **Required for**: Primary database
- **Installation**: Automatically handled via Docker Compose
- **Port**: 5487 (customized to avoid conflicts)

## Optional Tools

### Development Tools

#### VS Code (Recommended IDE)

- **Extensions**: ESLint, Prettier, TypeScript, Prisma
- **Configuration**: Project includes VS Code settings

#### pgAdmin

- **Purpose**: PostgreSQL database management GUI
- **Access**: http://localhost:5050 (when Docker services are running)
- **Credentials**: admin@ventry.local / pgadmin_dev_password

### Monitoring & Analytics

#### Sentry Account

- **Purpose**: Error tracking and performance monitoring
- **Required for**: Production deployment
- **Setup**: Free tier available at [sentry.io](https://sentry.io)

### AI Provider Accounts (Future Phase)

#### OpenAI API

- **Purpose**: AI agent functionality
- **Required for**: Phase 2+ AI features
- **Setup**: API key from [platform.openai.com](https://platform.openai.com)

#### Anthropic API

- **Purpose**: Alternative AI provider
- **Required for**: Phase 2+ AI features
- **Setup**: API key from [anthropic.com](https://anthropic.com)

## Hardware Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 2 GB free space
- **Network**: Stable internet connection

### Recommended Requirements

- **CPU**: 4+ cores
- **RAM**: 8 GB or more
- **Storage**: 5 GB free space (for Docker images and data)
- **Network**: High-speed internet for package downloads

## Operating System Compatibility

### Supported Operating Systems

- **macOS**: 11.0 (Big Sur) or later
- **Linux**: Ubuntu 20.04+, Debian 10+, Fedora 34+, or other modern distributions
- **Windows**: Windows 10 version 2004+ or Windows 11 (with WSL2 for Docker)

### Platform-Specific Notes

#### macOS

- Docker Desktop required for Docker services
- Homebrew recommended for package management

#### Linux

- Native Docker support
- May need to install Docker separately from distribution packages

#### Windows

- WSL2 required for optimal Docker performance
- Git Bash or WSL2 terminal recommended for running scripts
- Path handling may require adjustment in some scripts

## Environment Setup

### Required Environment Variables

The application requires configuration through environment variables. A `.env` file will be created during setup with the following:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT authentication
- `PORT`: Backend server port (default: 6060)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:6061)

### Optional Environment Variables

- `OPENAI_API_KEY`: For AI features (Phase 2+)
- `ANTHROPIC_API_KEY`: For AI features (Phase 2+)
- `SENTRY_DSN`: For error tracking
- `SMTP_CONFIG`: For email notifications

## Quick Compatibility Check

Run this command to verify your environment:

```bash
# Check Node.js version
node --version  # Should be v18.0.0 or higher

# Check pnpm version
pnpm --version  # Should be 8.0.0 or higher

# Check Git version
git --version   # Any recent version

# Check Docker version
docker --version  # Should be 20.10 or higher
docker-compose --version  # Should be v2.0 or higher
```

## Getting Started

Once all prerequisites are met:

1. Clone the repository
2. Run `./tools/scripts/dev-setup.sh` for automated setup
3. The script will verify all requirements and set up your development environment

For detailed setup instructions, see [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
