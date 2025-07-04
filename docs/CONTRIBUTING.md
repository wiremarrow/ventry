# Contributing to Ventry

Thank you for your interest in contributing to Ventry! This guide will help you get started with contributing to our AI-native inventory management system.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** and clone your fork
2. **Set up the development environment** following our [Development Guide](./DEVELOPMENT.md)
3. **Create a feature branch** from `main`
4. **Make your changes** following our coding standards
5. **Submit a pull request** with a clear description

## Development Process

### 1. Before You Start

- Check existing issues and PRs to avoid duplicate work
- For significant changes, open an issue first to discuss
- Ensure your development environment is properly set up

### 2. Branching Strategy

We use a simple branching strategy:

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `chore/*` - Maintenance tasks

Example: `feature/add-bulk-import`

### 3. Making Changes

#### Code Style

- **TypeScript**: Use strict mode, avoid `any` types
- **Formatting**: Run `pnpm format` before committing
- **Linting**: Ensure `pnpm lint` passes
- **Naming**: Use descriptive names for variables, functions, and files

#### Best Practices

1. **Keep changes focused**: One feature/fix per PR
2. **Write tests**: Maintain or improve test coverage
3. **Update documentation**: Keep docs in sync with code
4. **Follow patterns**: Consistency with existing code

### 4. Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

#### Examples
```
feat(backend): add stock advisor agent endpoint

- Implement POST /api/agents/stock-advisor/recommendation
- Add validation for product ID
- Include historical data analysis

Closes #123
```

```
fix(web): correct stock level display for multiple locations

Previously showed total instead of per-location counts
```

### 5. Testing

#### Running Tests
```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @ventry/backend test

# Run with coverage
pnpm test:coverage
```

#### Writing Tests
- Place unit tests next to source files: `module.spec.ts`
- Integration tests: `module.integration.spec.ts`
- E2E tests in `e2e/` directories
- Aim for >80% code coverage

### 6. Documentation

Update relevant documentation:
- **Code comments**: For complex logic
- **README files**: For new features
- **API documentation**: For new endpoints
- **Architecture docs**: For structural changes

## Pull Request Process

### 1. Pre-submission Checklist

- [ ] Code follows project style guidelines
- [ ] All tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] PR has a clear description

### 2. PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the project style
- [ ] I have performed a self-review
- [ ] I have commented complex code
- [ ] I have updated documentation
- [ ] My changes generate no warnings
```

### 3. Review Process

1. Automated checks must pass
2. At least one maintainer review required
3. Address review feedback
4. Maintain clear communication

## Working with AI Agents

When contributing to AI agent features:

### Prompt Engineering
- Use clear, structured prompts
- Include examples for consistency
- Version control prompt templates
- Test with multiple scenarios

### Testing AI Features
- Mock LLM responses in tests
- Test error handling
- Validate response parsing
- Check rate limiting

### Best Practices
- Log all AI interactions
- Handle failures gracefully
- Provide fallback options
- Monitor costs and performance

## Project-Specific Guidelines

### Backend (NestJS)
- Use dependency injection
- Follow module boundaries
- Implement DTOs for validation
- Use proper decorators

### Frontend (Next.js)
- Use App Router patterns
- Implement proper loading states
- Ensure mobile responsiveness
- Follow React best practices

### Database (Prisma)
- Create migrations for schema changes
- Maintain referential integrity
- Index frequently queried fields
- Document schema decisions

## Getting Help

- **Discord**: Join our community server
- **Issues**: Open a GitHub issue
- **Discussions**: Use GitHub Discussions
- **Email**: dev@ventry.com

## Recognition

Contributors will be:
- Listed in our CONTRIBUTORS file
- Mentioned in release notes
- Eligible for special badges

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

Thank you for contributing to Ventry! Your efforts help make inventory management more intelligent and efficient.