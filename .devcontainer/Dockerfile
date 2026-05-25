FROM docker.io/amazon/aws-cli:latest AS aws-cli

FROM node:lts-slim

# Install basic utilities
RUN apt-get update && \
    apt-get install -y \
        git \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Install AWS Cli
ENV AWS_CLI_HOME=/usr/local/aws-cli
COPY --from=aws-cli $AWS_CLI_HOME $AWS_CLI_HOME
COPY --from=aws-cli /usr/local/bin/ /usr/local/bin/

# Install pnpm
RUN corepack enable && \
    corepack prepare pnpm@latest --activate

RUN npx playwright install-deps

# Switch to node user
USER node
RUN mkdir -p /home/node/.aws
ENV PNPM_HOME="/home/node/.pnpm"
ENV PATH="$PNPM_HOME/bin:/home/node/.local/bin:$PATH"

RUN curl -fsSL https://claude.ai/install.sh | bash
RUN pnpm add -g @playwright/cli

# Keep container running
CMD ["sleep", "infinity"]
