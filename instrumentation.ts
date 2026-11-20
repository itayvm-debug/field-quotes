import type { Instrumentation } from 'next'

// Records every unhandled server error (pages, route handlers, server actions,
// proxy) in app_errors. Errors a route catches itself (e.g. the PDF route) are
// logged there explicitly with logServerError.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logServerError } = await import('./lib/errorLog')
  await logServerError(err, {
    route: request.path,
    // Request headers are deliberately not stored (cookies / tokens)
    context: {
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    },
  })
}
