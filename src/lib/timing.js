export function throttle(fn, ms) {
  let last = 0;
  let timer = 0;
  let trailingArgs = null;

  const run = (args) => {
    last = Date.now();
    trailingArgs = null;
    fn(...args);
  };

  const wrapped = (...args) => {
    const remaining = ms - (Date.now() - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      run(args);
      return;
    }
    trailingArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (trailingArgs) run(trailingArgs);
    }, remaining);
  };

  wrapped.cancel = () => {
    clearTimeout(timer);
    trailingArgs = null;
  };

  return wrapped;
}

export function debounce(fn, ms) {
  let timer = 0;
  let lastArgs = null;

  const wrapped = (...args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const pending = lastArgs;
      lastArgs = null;
      fn(...pending);
    }, ms);
  };

  wrapped.flush = () => {
    if (!lastArgs) return;
    clearTimeout(timer);
    const pending = lastArgs;
    lastArgs = null;
    fn(...pending);
  };

  wrapped.cancel = () => {
    clearTimeout(timer);
    lastArgs = null;
  };

  return wrapped;
}
