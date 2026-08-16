// Stub for @tamagui/popper which incorrectly imports react-dom in its native bundle.
exports.flushSync = (fn) => fn();
exports.createPortal = (children) => children;
exports.findDOMNode = () => null;
exports.render = () => {};
exports.unmountComponentAtNode = () => false;
