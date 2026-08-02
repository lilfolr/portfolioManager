/// <reference types="nativewind/types" />

/** `import '../global.css'` at the app entry is how NativeWind's Metro
 * transform picks up the stylesheet; it has no runtime value. */
declare module '*.css';
