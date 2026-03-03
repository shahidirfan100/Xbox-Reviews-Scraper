# Specify a lightweight Node.js base image (Playwright not required)
# Check available versions: https://hub.docker.com/r/apify/actor-node
FROM apify/actor-node:22

# Copy just package.json and package-lock.json first for caching
COPY --chown=myuser:myuser package*.json ./

# Install NPM packages (production only)
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version \
    && rm -r ~/.npm

# Copy remaining source code
COPY --chown=myuser:myuser . ./

# Start the actor
CMD npm start --silent
