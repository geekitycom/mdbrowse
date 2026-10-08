# mdbrowse

A browser for the web of Markdown, running inside your browser. Type a URL in
the address bar and mdbrowse fetches it asking for Markdown, then renders it as
GitHub-flavored Markdown. Links open inside mdbrowse, and Back, Forward and
`#section` links work the way they do in a normal browser.

- Requests send `Accept: text/markdown, text/x-markdown;q=0.9, text/plain;q=0.8`.
  A response is shown only if it is one of those types and its body is not an
  HTML document.
- An address without a scheme tries `https://` first, then `http://`.
- Clicking a link that turns out not to be Markdown opens it in the same tab
  as a normal web page, and Back returns to mdbrowse. Cmd-click, Ctrl-click
  and "Open in new tab" open the link in mdbrowse in a new tab, which goes on
  to the normal page when it is not Markdown. An address typed into the bar,
  or a `/?url=` link from another site, shows an error for a non-Markdown page
  instead, so `/?url=` can't be used to send people to arbitrary sites.
- When a site's root page has no Markdown, mdbrowse tries the site's
  [`/llms.txt`](https://llmstxt.org) and goes there if it is Markdown.
- An error response with a Markdown body is shown, with its status code in the
  status line.
- Front matter is optional. A `title` is shown as the heading when the
  document has no `# H1`, and `previous`, `home` and `next` appear as links
  on the right of the status bar, and an `updated`, `last_modified` or
  `modified` date is shown in the status line in the reader's locale.
- Raw HTML in a document is sanitized to an allowlist modeled on GitHub's.
- The start page, at `/`, is [`homepage.md`](homepage.md).

## Run it locally

You need Node.js 24. pnpm comes from Corepack, at the version pinned in
`package.json`:

```sh
corepack enable
pnpm install
pnpm start
```

Then open <http://localhost:3000>. `pnpm start` restarts the server when
`server.js` or a module it imports changes. Files under `public/` and
`homepage.md` are read on every request, so a browser refresh picks them up.

`pnpm install` also installs the Git hook
that checks commit messages (see [Releasing](#releasing)).

Node.js 25 and later no longer include Corepack. On those versions, install it
first with `npm install --global corepack`.

Run the tests with:

```sh
pnpm test
```

### Configuration

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `3000` | The port the server listens on. |
| `MDBROWSE_ALLOW_PRIVATE` | unset | Set to `true` to let mdbrowse fetch loopback, private and link-local addresses. |

By default mdbrowse refuses to fetch any address that is not on the public
internet. It checks each redirect too. This stops a deployed instance from
being used to reach the server's own network. To browse Markdown served from
your own machine during development, start it with:

```sh
MDBROWSE_ALLOW_PRIVATE=true pnpm start
```

Do not set `MDBROWSE_ALLOW_PRIVATE` on a deployed instance.

## Releasing

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org).
A Husky `commit-msg` hook runs commitlint and rejects any other format.

[release-please](https://github.com/googleapis/release-please) runs on every
push to `main`. It keeps a release pull request open that bumps the version in
`package.json` and updates `CHANGELOG.md`:

- `fix:` makes a patch release.
- `feat:` makes a minor release.
- `feat!:`, or a `BREAKING CHANGE:` footer, makes a major release.
- Other types, such as `build:`, `ci:` and `docs:`, do not make a release on
  their own.

Merging the release pull request tags the version and creates the GitHub
release. It does not publish a Docker image. See the next section.

## Publishing the Docker image

The image is built and pushed by hand, because GitHub's hosted runners are
amd64 only and the server may be arm64. The build script makes one image for
`linux/amd64` and `linux/arm64`.

1. Merge the release pull request.
2. Update your local `main`:

   ```sh
   git pull
   ```

3. Build and push:

   ```sh
   pnpm docker:build-push
   ```

This pushes `ghcr.io/geekitycom/mdbrowse:<version>` and
`ghcr.io/geekitycom/mdbrowse:latest`, where `<version>` comes from
`package.json`. Docker must be running. If you are not logged in to ghcr.io,
the script runs `docker login ghcr.io`. Use your GitHub username and a personal
access token with the `write:packages` scope as the password.

Other forms:

```sh
pnpm docker:dry-run                        # print the tags; build nothing
pnpm docker:build-push beta                # also push the tag "beta"
./scripts/docker-build-push.sh --check-only   # check Docker and the login only
```

To confirm the image has both platforms:

```sh
docker buildx imagetools inspect ghcr.io/geekitycom/mdbrowse:<version>
```

A package on ghcr.io is private when it is first pushed. Either make it public
in the package's settings on GitHub, or run `docker login ghcr.io` on the
server with a token that has the `read:packages` scope.

## Deploying with dockge

[`deploy/compose.yaml`](deploy/compose.yaml) runs the published image as a
[dockge](https://github.com/louislam/dockge) stack. Plain `docker compose`
reads it the same way. Nothing else from this repository is needed on the
server, and the app keeps no state, so there are no volumes to set up.

1. In dockge, create a stack called `mdbrowse` and paste in the contents of
   `deploy/compose.yaml`.
2. In the stack's `.env`, set the version to run:

   ```sh
   MDBROWSE_TAG=1.1.0
   ```

   The stack does not start without it. You can use `latest`, but a pinned
   version lets you roll back by setting the previous one.
3. Optional: to publish on a host port other than 3000, add
   `MDBROWSE_HOST_PORT=8080` to the `.env`.
4. Start the stack.
5. Point your reverse proxy at `http://127.0.0.1:3000`, or at the port you set.
   The proxy terminates TLS. mdbrowse needs no forwarded headers.

The container publishes on `127.0.0.1` only, so it can be reached through the
reverse proxy and not directly from the internet. It runs as an unprivileged
user on a read-only filesystem, with no Linux capabilities and a 256 MB memory
limit. Docker checks `/healthz` every minute and marks the container unhealthy
if it stops answering.

To upgrade, publish the new image, change `MDBROWSE_TAG` in the `.env`, and
update the stack. To roll back, set the previous version and update again.

To change the start page, edit `homepage.md`. It is part of the image, so the
change goes live with the next published image.
