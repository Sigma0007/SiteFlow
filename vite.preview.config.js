// vite.preview.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Plugin to handle Tailwind CSS arbitrary values in JSX
const handleTailwindArbitraryValues = () => {
  return {
    name: 'handle-tailwind-arbitrary-values',
    enforce: 'pre', // Run before other plugins
    transform(code, id) {
      if (id.match(/\.(jsx|tsx)$/)) {
        // Detect probable tailwind arbitrary value syntax issues
        if (code.includes('[') && code.includes(']') && 
            (code.includes('className=') || code.includes('class='))) {
          try {
            // Simple approach: handle common cases of Tailwind arbitrary values
            // This replaces problematic patterns that often cause parsing errors
            
            // Replace className="... w-[42rem] ..." with className="... w-full ..."
            let modifiedCode = code.replace(/(\s|"|'|{)w-\[.*?\](\s|"|'|})/g, '$1w-full$2');
            
            // Replace className="... h-[600px] ..." with className="... h-64 ..."
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)h-\[.*?\](\s|"|'|})/g, '$1h-64$2');
            
            // Replace className="... text-[17px] ..." with className="... text-base ..."
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)text-\[.*?\](\s|"|'|})/g, '$1text-base$2');
            
            // Replace className="... mt-[27px] ..." with className="... mt-6 ..."
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)mt-\[.*?\](\s|"|'|})/g, '$1mt-6$2');
            
            // Replace className="... mb-[27px] ..." with className="... mb-6 ..."
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)mb-\[.*?\](\s|"|'|})/g, '$1mb-6$2');
            
            // Replace className="... p-[15px] ..." with className="... p-4 ..."
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)p-\[.*?\](\s|"|'|})/g, '$1p-4$2');
            
            // Replace className="... px-[15px] ..." with className="... px-4 ..."
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)px-\[.*?\](\s|"|'|})/g, '$1px-4$2');
            
            // Replace className="... py-[15px] ..." with className="... py-4 ..."
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)py-\[.*?\](\s|"|'|})/g, '$1py-4$2');
            
            // Replace className="... font-[600] ..." with className="... font-bold ..."
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)font-\[.*?\](\s|"|'|})/g, '$1font-bold$2');
            
            // Replace className="... rounded-[10px] ..." with className="... rounded-lg ..."
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)rounded-\[.*?\](\s|"|'|})/g, '$1rounded-lg$2');
            
            // Replace other common tailwind arbitrary values
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)gap-\[.*?\](\s|"|'|})/g, '$1gap-4$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)grid-cols-\[.*?\](\s|"|'|})/g, '$1grid-cols-3$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)cols-\[.*?\](\s|"|'|})/g, '$1cols-3$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)inset-\[.*?\](\s|"|'|})/g, '$1inset-0$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)top-\[.*?\](\s|"|'|})/g, '$1top-0$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)left-\[.*?\](\s|"|'|})/g, '$1left-0$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)right-\[.*?\](\s|"|'|})/g, '$1right-0$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)bottom-\[.*?\](\s|"|'|})/g, '$1bottom-0$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)translate-\[.*?\](\s|"|'|})/g, '$1translate-x-0$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)rotate-\[.*?\](\s|"|'|})/g, '$1rotate-0$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)scale-\[.*?\](\s|"|'|})/g, '$1scale-100$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)skew-\[.*?\](\s|"|'|})/g, '$1skew-x-0$2');
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)origin-\[.*?\](\s|"|'|})/g, '$1origin-center$2');
            
            // Handle font family arbitrary values which are common issues
            modifiedCode = modifiedCode.replace(/(\s|"|'|{)font-\[("|').*?("|')\](\s|"|'|})/g, '$1font-sans$4');
            
            // Log the changes for debugging
            if (code !== modifiedCode) {
              console.log(`[Tailwind Fix] Modified JSX file: ${id}`);
            }
            
            return {
              code: modifiedCode,
              map: null
            };
          } catch (error) {
            console.error(`[Tailwind Fix] Error processing file ${id}:`, error);
            // Return original code if transform fails
            return null;
          }
        }
      }
      return null;
    }
  };
};

// Enhanced plugin to handle all error cases and expose errors to frontend
const createErrorFreeBuilder = () => {
  // Track all errors during build
  const buildErrors = {
    missingModules: new Set(),
    missingPackages: new Set(),
    missingComponents: new Set(),
    runtimeErrors: new Set()
  };
  
  // Track specific exports requested from specific modules
  const requestedExports = new Map();
  
  return {
    name: 'error-free-builder',
    
    // Handle icons/libraries imported but not available
    resolveId(source, importer) {
      // Special case for Vite's preload helper
      if (source === 'vite/preload-helper' || 
        source === 'vite/preload-helper.js' || 
        source === 'vite/preload-helper.mjs' ||
        source.includes('preload-helper')) {
      console.log('[Preview] Silently handling internal Vite module:', source);
      return '\0virtual:vite-preload-helper';
    }
      
      // Analyze imports to track requested exports
      if (importer && source) {
        try {
          const importerContent = fs.readFileSync(importer, 'utf8');
          
          // Look for named imports from this source
          const importRegex = new RegExp(`import\\s+{([^}]*)}\\s+from\\s+['"]${source.replace(/\./g, '\\.')}['"]`, 'g');
          const matches = [...importerContent.matchAll(importRegex)];
          
          if (matches.length > 0) {
            if (!requestedExports.has(source)) {
              requestedExports.set(source, new Set());
            }
            
            matches.forEach(match => {
              const namedImports = match[1].split(',').map(i => i.trim());
              namedImports.forEach(name => {
                // Handle "X as Y" syntax
                const actualName = name.split(' as ')[0].trim();
                requestedExports.get(source).add(actualName);
              });
            });
          }
        } catch (e) {
          // Ignore read errors
        }
      }
      
      // Handle node_modules imports
      if (importer && !source.startsWith('.') && !source.startsWith('/') && !path.isAbsolute(source)) {
        try {
          // Try to resolve in node_modules
          require.resolve(source);
          return null; // Let Vite handle it if it exists
        } catch (e) {
          // Node module doesn't exist, track error and create virtual module
          buildErrors.missingPackages.add(source);
          return `\0virtual:missing-package:${source}`;
        }
      }
      
      // Handle local imports (from user's code)
      if (importer && (source.startsWith('./') || source.startsWith('../'))) {
        const importerDir = path.dirname(importer);
        const absolutePath = path.resolve(importerDir, source);
        
        // Try to resolve with various extensions
        const extensions = ['.jsx', '.js', '.tsx', '.ts', '.json', '/index.jsx', '/index.js', '/index.tsx', '/index.ts'];
        for (const ext of extensions) {
          const fullPath = `${absolutePath}${ext}`;
          if (fs.existsSync(fullPath)) {
            return null; // File exists, let Vite handle it normally
          }
        }
        
        // Local file doesn't exist, track error and return virtual module
        buildErrors.missingModules.add(source);
        return `\0virtual:missing-module:${source}`;
      }
      
      return null;
    },
    
    // Load appropriate content for missing modules
    load(id) {
      // Special handling for Vite's preload helper
      if (id === '\0virtual:vite-preload-helper') {
        // Create a stub implementation of Vite's preload helper
        return `
          // This is a stub implementation of Vite's preload helper
          const seen = {};
          export const __vitePreload = function preload(baseModule, deps, importerUrl) {
            // This is a simplified version that just returns the module without preloading
            if (!deps || deps.length === 0) {
              return baseModule();
            }
            
            // Mark deps as seen to avoid loading them again
            deps.forEach(dep => {
              if (!seen[dep]) {
                seen[dep] = true;
                console.log("[Preview] Would preload:", dep);
              }
            });
            
            return baseModule();
          };
        `;
      }
      
      // Handle missing packages (node_modules)
      if (id.startsWith('\0virtual:missing-package:')) {
        const packageName = id.slice('\0virtual:missing-package:'.length);
        
        // Special handling for use-sound package
        if (packageName === 'use-sound' || packageName.includes('sound')) {
          return `
            import React from 'react';
            
            // Register error with the global registry
            if (typeof window !== 'undefined') {
              window.__ERROR_REGISTRY = window.__ERROR_REGISTRY || {
                missingModules: new Set(),
                missingPackages: new Set(),
                missingComponents: new Set(),
                runtimeErrors: new Set(),
                getErrors: function() {
                  return {
                    missingModules: Array.from(this.missingModules),
                    missingPackages: Array.from(this.missingPackages),
                    missingComponents: Array.from(this.missingComponents),
                    runtimeErrors: Array.from(this.runtimeErrors)
                  };
                }
              };
              window.__ERROR_REGISTRY.missingPackages.add('${packageName}');
            }
            
            // Create a stub implementation of useSound hook
            export default function useSound(src, options = {}) {
              // Return a play function and other expected properties
              return [
                () => console.log('Sound would play:', src), 
                { 
                  sound: null,
                  stop: () => {},
                  pause: () => {},
                  isPlaying: false
                }
              ];
            }
            
            // Additional exports
            export const useHowl = () => {};
            export const useHowler = () => {};
          `;
        }
        
        // Special handling for icon libraries
        if (
          packageName.includes('icon') || 
          packageName.includes('lucide') || 
          packageName.includes('feather') ||
          packageName.includes('heroicons') ||
          packageName.includes('font-awesome') ||
          packageName.includes('material') ||
          packageName.includes('bootstrap') ||
          packageName.includes('mdi')
        ) {
          return `
            import React from 'react';
            
            // Register error with the global registry
            if (typeof window !== 'undefined') {
              window.__ERROR_REGISTRY = window.__ERROR_REGISTRY || {
                missingModules: new Set(),
                missingPackages: new Set(),
                missingComponents: new Set(),
                runtimeErrors: new Set(),
                getErrors: function() {
                  return {
                    missingModules: Array.from(this.missingModules),
                    missingPackages: Array.from(this.missingPackages),
                    missingComponents: Array.from(this.missingComponents),
                    runtimeErrors: Array.from(this.runtimeErrors)
                  };
                }
              };
              window.__ERROR_REGISTRY.missingPackages.add('${packageName}');
            }
            
            // Create a stub icon component
            const IconStub = (props) => {
              return React.createElement('div', {
                ...props,
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '1em',
                  height: '1em',
                  backgroundColor: '#ffcccc',
                  color: 'red',
                  border: '1px solid red',
                  borderRadius: '4px',
                  fontSize: 'inherit',
                  verticalAlign: 'middle',
                  overflow: 'hidden',
                  ...props.style
                }
              }, '⚠️');
            };
            
            // Export a handler that returns icon stubs for any icon
            export default IconStub;
            
            // Export a proxy to handle any icon import
            const handler = {
              get: function(target, prop) {
                if (typeof prop === 'string' && !prop.startsWith('_')) {
                  if (typeof window !== 'undefined') {
                    window.__ERROR_REGISTRY.missingComponents.add(\`\${prop} (from ${packageName})\`);
                  }
                  console.warn(\`Using placeholder for missing icon: \${prop} from "${packageName}"\`);
                  return IconStub;
                }
                return target[prop];
              }
            };
            
            // This will handle named imports like { Icon1, Icon2 }
            export const icons = new Proxy({}, handler);
            
            // Common icon exports
            export const IconName = IconStub;
            export const Icon = IconStub;
            export const Icons = new Proxy({}, handler);
            
            // Handle specific icon libraries
            export const AlertCircle = IconStub;
            export const ArrowRight = IconStub;
            export const ArrowLeft = IconStub;
            export const Check = IconStub;
            export const ChevronDown = IconStub;
            export const ChevronUp = IconStub;
            export const ChevronLeft = IconStub;
            export const ChevronRight = IconStub;
            export const Close = IconStub;
            export const Edit = IconStub;
            export const Eye = IconStub;
            export const EyeOff = IconStub;
            export const Heart = IconStub;
            export const Home = IconStub;
            export const Info = IconStub;
            export const Menu = IconStub;
            export const MoreHorizontal = IconStub;
            export const MoreVertical = IconStub;
            export const Search = IconStub;
            export const Settings = IconStub;
            export const ShoppingBag = IconStub;
            export const ShoppingCart = IconStub;
            export const Star = IconStub;
            export const Trash = IconStub;
            export const User = IconStub;
            export const X = IconStub;
            
            // Add 100+ more common icon names
            const commonIcons = [
              'Add', 'AddCircle', 'Alert', 'Analytics', 'Archive', 'ArrowDown', 'ArrowUp',
              'Attachment', 'Back', 'Bell', 'Bookmark', 'Calendar', 'Camera', 'Chat',
              'ChatBubble', 'Clock', 'Cloud', 'Code', 'Cog', 'Comment', 'Copy', 'CreditCard',
              'Dashboard', 'Delete', 'Download', 'Email', 'Error', 'Expand', 'ExternalLink',
              'Facebook', 'Filter', 'Flag', 'Folder', 'Forward', 'Fullscreen', 'Gift',
              'Github', 'Globe', 'Google', 'Grid', 'HelpCircle', 'Image', 'Instagram',
              'Key', 'Label', 'Link', 'LinkedIn', 'List', 'Location', 'Lock', 'Login',
              'Logout', 'Mail', 'Map', 'Message', 'Minus', 'Money', 'Moon', 'Notification',
              'Pause', 'Pencil', 'Phone', 'Photo', 'Pin', 'Play', 'Plus', 'PlusCircle',
              'Power', 'Print', 'Refresh', 'Save', 'Send', 'Share', 'Shield', 'ShoppingBag',
              'Shuffle', 'Sidebar', 'SignOut', 'Slack', 'Sliders', 'Sort', 'Sun', 'Support',
              'Tag', 'ThumbsDown', 'ThumbsUp', 'Timer', 'Tool', 'Trending', 'Twitter', 'Undo',
              'Unlock', 'Upload', 'Video', 'View', 'Warning', 'Wifi', 'Youtube', 'ZoomIn', 'ZoomOut'
            ];
            
            // Add all common icons as exports
            commonIcons.forEach(iconName => {
              exports[iconName] = IconStub;
            });
          `;
        }
        
        // Handle animation libraries
        if (packageName.includes('motion') || packageName.includes('anim') || packageName.includes('framer')) {
          return `
            import React from 'react';
            
            // Register error with the global registry
            if (typeof window !== 'undefined') {
              window.__ERROR_REGISTRY = window.__ERROR_REGISTRY || {
                missingModules: new Set(),
                missingPackages: new Set(),
                missingComponents: new Set(),
                runtimeErrors: new Set(),
                getErrors: function() {
                  return {
                    missingModules: Array.from(this.missingModules),
                    missingPackages: Array.from(this.missingPackages),
                    missingComponents: Array.from(this.missingComponents),
                    runtimeErrors: Array.from(this.runtimeErrors)
                  };
                }
              };
              window.__ERROR_REGISTRY.missingPackages.add('${packageName}');
            }
            
            // Mock motion component creator
            const createMotionComponent = (Component) => {
              return (props) => {
                return React.createElement(Component, {
                  ...props,
                  style: {
                    ...props.style,
                    transition: 'all 0.3s ease'
                  }
                }, props.children);
              };
            };
            
            // Export common components
            export const motion = {
              div: createMotionComponent('div'),
              span: createMotionComponent('span'),
              button: createMotionComponent('button'),
              a: createMotionComponent('a'),
              ul: createMotionComponent('ul'),
              li: createMotionComponent('li'),
              p: createMotionComponent('p'),
              h1: createMotionComponent('h1'),
              h2: createMotionComponent('h2'),
              img: createMotionComponent('img'),
              nav: createMotionComponent('nav'),
              section: createMotionComponent('section'),
              footer: createMotionComponent('footer'),
              header: createMotionComponent('header')
            };
            
            // Animation utilities - include all commonly used variants/animations
            export const fadeIn = (delay = 0) => ({
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { duration: 0.5, delay } }
            });
            
            export const slideIn = (direction, delay = 0) => ({
              hidden: { 
                x: direction === 'left' ? '-100%' : direction === 'right' ? '100%' : 0,
                y: direction === 'up' ? '100%' : direction === 'down' ? '-100%' : 0 
              },
              show: { 
                x: 0, 
                y: 0, 
                transition: { duration: 0.5, delay } 
              }
            });
            
            export const staggerContainer = (delay = 0) => ({
              hidden: {},
              show: { transition: { staggerChildren: 0.1, delayChildren: delay } }
            });
            
            export const textVariant = (delay = 0) => ({
              hidden: { y: 20, opacity: 0 },
              show: { y: 0, opacity: 1, transition: { duration: 0.5, delay } }
            });
            
            export const zoomIn = (delay = 0) => ({
              hidden: { scale: 0, opacity: 0 },
              show: { scale: 1, opacity: 1, transition: { duration: 0.5, delay } }
            });
            
            export default motion;
          `;
        }
        
        // Generic package stub for other libraries
        return `
          import React from 'react';
          
          // Register error with the global registry
          if (typeof window !== 'undefined') {
            window.__ERROR_REGISTRY = window.__ERROR_REGISTRY || {
              missingModules: new Set(),
              missingPackages: new Set(),
              missingComponents: new Set(),
              runtimeErrors: new Set(),
              getErrors: function() {
                return {
                  missingModules: Array.from(this.missingModules),
                  missingPackages: Array.from(this.missingPackages),
                  missingComponents: Array.from(this.missingComponents),
                  runtimeErrors: Array.from(this.runtimeErrors)
                };
              }
            };
            window.__ERROR_REGISTRY.missingPackages.add('${packageName}');
          }
          
          // Create error message for missing package
          const errorMessage = 'Missing package: ${packageName}';
          console.warn(errorMessage);
          
          // Default export as function
          export default function MissingPackage(...args) {
            console.warn(\`Using placeholder for missing package: ${packageName}\`);
            return React.createElement('div', { 
              style: { 
                color: 'red',
                border: '1px solid red',
                padding: '10px',
                margin: '10px',
                borderRadius: '4px',
                fontSize: '12px'
              } 
            }, errorMessage);
          }
          
          // Handle dynamic property access
          const handler = {
            get: function(target, prop) {
              if (typeof prop === 'string' && !prop.startsWith('_')) {
                if (typeof window !== 'undefined') {
                  window.__ERROR_REGISTRY.missingComponents.add(\`\${prop} (from ${packageName})\`);
                }
                // Return a function for method calls
                return function(...args) {
                  console.warn(\`Using placeholder for missing method: \${prop} from "${packageName}"\`);
                  return null;
                };
              }
              return target[prop];
            }
          };
          
          // Export proxy object for destructuring imports
          export const LibProxy = new Proxy({}, handler);
          
          // Common exports for various libraries
          export const axios = { get: () => Promise.resolve({ data: {} }), post: () => Promise.resolve({ data: {} }) };
          export const fetch = () => Promise.resolve({ json: () => ({}) });
          export const render = () => null;
          export const Provider = ({children}) => children;
          export const createContext = () => ({ Provider: ({children}) => children, Consumer: ({children}) => children });
          export const useState = (initial) => [initial, () => {}];
          export const useEffect = () => {};
          export const useRef = () => ({ current: null });
          export const useContext = () => ({});
          export const useReducer = (reducer, initial) => [initial, () => {}];
          export const useMemo = (fn) => fn();
          export const useCallback = (fn) => fn;
          export const createStore = () => ({ getState: () => ({}), dispatch: () => {}, subscribe: () => {} });
          export const combineReducers = () => (() => ({}));
          export const connect = () => (Component) => Component;
          export const styled = new Proxy({}, { get: (_, tag) => (() => tag) });
          
          // Add the __vitePreload function for packages that might need it
          export const __vitePreload = function preload(baseModule, deps) {
            return baseModule();
          };
          
          // Common named exports for various libraries
          export const Button = (props) => React.createElement('button', props, props.children);
          export const Input = (props) => React.createElement('input', props);
          export const Form = (props) => React.createElement('form', props, props.children);
          export const Table = (props) => React.createElement('table', props, props.children);
          export const Modal = (props) => React.createElement('div', props, props.children);
          export const Card = (props) => React.createElement('div', props, props.children);
          export const Container = (props) => React.createElement('div', props, props.children);
          export const Row = (props) => React.createElement('div', props, props.children);
          export const Col = (props) => React.createElement('div', props, props.children);
        `;
      }
      
      // Handle missing local modules
      if (id.startsWith('\0virtual:missing-module:')) {
        const moduleName = id.slice('\0virtual:missing-module:'.length);
        
        // Check if this module has requested specific exports
        const requestedSpecificExports = requestedExports.get(moduleName) || new Set();
        
        // Create additional exports based on module name or requested exports
        let additionalExports = '';
        
        // Add exports for specific requested exports not covered by the general exports
        if (requestedSpecificExports.size > 0) {
          console.log(`Requested exports for ${moduleName}:`, Array.from(requestedSpecificExports));
          
          for (const exportName of requestedSpecificExports) {
            // Skip exports that will be generated automatically
            if ([
              'motion', 'fadeIn', 'slideIn', 'staggerContainer', 'textVariant', 'zoomIn',
              'data', 'items', 'products', 'routes', 'config', 'settings', 'constants', 'theme', 'styles',
              'App', 'Home', 'Layout', 'CategoryDetails'
            ].includes(exportName)) {
              continue;
            }
            
            additionalExports += `
              // Export ${exportName} specifically requested from ${moduleName}
              export const ${exportName} = ${exportName.match(/^[A-Z]/) 
                ? `(props) => React.createElement('div', {
                    style: {
                      color: 'red',
                      border: '1px solid red',
                      padding: '20px',
                      margin: '20px',
                      borderRadius: '4px'
                    }
                  }, \`Error: Component "${exportName}" not found in "${moduleName}"\`)`
                : `() => {
                    if (typeof window !== 'undefined') {
                      window.__ERROR_REGISTRY.missingComponents.add(\`${exportName} (from ${moduleName})\`);
                    }
                    console.warn(\`Using placeholder for missing function: ${exportName} from "${moduleName}"\`);
                    return null;
                  }`
              };
            `;
          }
        }
        
        // Create a placeholder for the missing module with error registry
        return `
          import React from 'react';
          
          // Register error with the global registry
          if (typeof window !== 'undefined') {
            window.__ERROR_REGISTRY = window.__ERROR_REGISTRY || {
              missingModules: new Set(),
              missingPackages: new Set(),
              missingComponents: new Set(),
              runtimeErrors: new Set(),
              getErrors: function() {
                return {
                  missingModules: Array.from(this.missingModules),
                  missingPackages: Array.from(this.missingPackages),
                  missingComponents: Array.from(this.missingComponents),
                  runtimeErrors: Array.from(this.runtimeErrors)
                };
              }
            };
            window.__ERROR_REGISTRY.missingModules.add('${moduleName}');
          }
          
          // Default export for the missing module with visual error
          export default function ErrorComponent() {
            return React.createElement('div', {
              style: {
                color: 'red',
                border: '1px solid red',
                padding: '20px',
                margin: '20px',
                borderRadius: '4px'
              }
            }, 'Error: Component "${moduleName}" not found');
          }
          
          // Create a handler for any named exports
          const handler = {
            get: function(target, prop) {
              if (typeof prop === 'string' && !prop.startsWith('_')) {
                if (typeof window !== 'undefined') {
                  window.__ERROR_REGISTRY.missingComponents.add(\`\${prop} (from ${moduleName})\`);
                }
                
                if (prop.match(/^[A-Z]/)) {
                  // Likely a React component
                  return function(props) {
                    return React.createElement('div', {
                      style: {
                        color: 'red',
                        border: '1px solid red',
                        padding: '20px',
                        margin: '20px',
                        borderRadius: '4px'
                      }
                    }, \`Error: Component "\${prop}" not found in "${moduleName}"\`);
                  };
                } else {
                  // Likely a utility function
                  return function() {
                    console.warn(\`Using placeholder for missing function: \${prop} from "${moduleName}"\`);
                    return null;
                  };
                }
              }
              return target[prop];
            }
          };
          
          // Export placeholder for common utilities
          export const components = new Proxy({}, handler);
          export const utils = new Proxy({}, handler);
          export const helpers = new Proxy({}, handler);
          
          // Export empty data structures for common exports
          export const data = [];
          export const items = [];
          export const products = [];
          export const routes = [];
          export const config = {};
          export const settings = {};
          export const constants = {};
          export const theme = {};
          export const styles = {};
          
          // Always include animation utilities for any module
          // These are very commonly used in React projects
          export const fadeIn = (delay = 0) => ({
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { duration: 0.5, delay } }
          });
          
          export const slideIn = (direction, delay = 0) => ({
            hidden: { 
              x: direction === 'left' ? '-100%' : direction === 'right' ? '100%' : 0,
              y: direction === 'up' ? '100%' : direction === 'down' ? '-100%' : 0 
            },
            show: { 
              x: 0, 
              y: 0, 
              transition: { duration: 0.5, delay } 
            }
          });
          
          // Adding staggerContainer since it's specifically mentioned in the error
          export const staggerContainer = (delay = 0) => ({
            hidden: {},
            show: { transition: { staggerChildren: 0.1, delayChildren: delay || 0 } }
          });
          
          export const textVariant = (delay = 0) => ({
            hidden: { y: 20, opacity: 0 },
            show: { y: 0, opacity: 1, transition: { duration: 0.5, delay } }
          });
          
          export const zoomIn = (delay = 0) => ({
            hidden: { scale: 0, opacity: 0 },
            show: { scale: 1, opacity: 1, transition: { duration: 0.5, delay } }
          });
          
          // Common component exports
          export const App = (props) => React.createElement('div', {
            style: {
              color: 'red',
              border: '1px solid red',
              padding: '20px',
              margin: '20px',
              borderRadius: '4px'
            }
          }, \`Error: Component "App" not found in "${moduleName}"\`);
          
          export const Home = (props) => React.createElement('div', {
            style: {
              color: 'red',
              border: '1px solid red',
              padding: '20px',
              margin: '20px',
              borderRadius: '4px'
            }
          }, \`Error: Component "Home" not found in "${moduleName}"\`);
          
          export const Layout = (props) => React.createElement('div', {
            style: {
              color: 'red',
              border: '1px solid red',
              padding: '20px',
              margin: '20px',
              borderRadius: '4px'
            }
          }, \`Error: Component "Layout" not found in "${moduleName}"\`);
          
          export const CategoryDetails = (props) => React.createElement('div', {
            style: {
              color: 'red',
              border: '1px solid red',
              padding: '20px',
              margin: '20px',
              borderRadius: '4px'
            }
          }, \`Error: Component "CategoryDetails" not found in "${moduleName}"\`);
          
          ${additionalExports}
          
          // Add many common component exports
          ['Header', 'Footer', 'Sidebar', 'Navigation', 'Menu', 'Card', 'Button', 'Form', 
           'Input', 'Select', 'Checkbox', 'Radio', 'Modal', 'Table', 'List', 'Item', 
           'Container', 'Section', 'Wrapper', 'Grid', 'Row', 'Column'].forEach(name => {
            exports[name] = (props) => React.createElement('div', {
              style: {
                color: 'red',
                border: '1px solid red',
                padding: '20px',
                margin: '20px',
                borderRadius: '4px'
              }
            }, \`Error: Component "\${name}" not found in "${moduleName}"\`);
          });
        `;
      }
      
      return null;
    },
    
    // Add error registry to HTML
    transformIndexHtml(html) {
      // Create error registry for tracking all errors
      return html.replace('</head>', `
        <script>
          console.log("[Preview] Initializing error tracking...");
          
          // Create global error registry
          window.__ERROR_REGISTRY = {
            missingModules: new Set(),
            missingPackages: new Set(),
            missingComponents: new Set(),
            runtimeErrors: new Set(),
            
            // Track if we've sent errors already
            hasSentInitialErrors: false,
            
            // Method to get all errors as arrays
            getErrors: function() {
              return {
                missingModules: Array.from(this.missingModules),
                missingPackages: Array.from(this.missingPackages),
                missingComponents: Array.from(this.missingComponents),
                runtimeErrors: Array.from(this.runtimeErrors)
              };
            },
            
            // Send errors to parent window via postMessage - only if we have errors
            sendErrorsToParent: function() {
              try {
                const errors = this.getErrors();
                const hasErrors = 
                  errors.missingModules.length > 0 || 
                  errors.missingPackages.length > 0 || 
                  errors.missingComponents.length > 0 ||
                  errors.runtimeErrors.length > 0;
                
                if (hasErrors) {
                  console.log("[Preview] Sending errors to parent:", errors);
                  window.parent.postMessage({
                    type: 'PREVIEW_ERRORS',
                    payload: errors
                  }, '*');
                }
              } catch (err) {
                console.warn('[Preview] Failed to send errors to parent:', err);
              }
            }
          };
          
          // Register a missing module
          window.registerMissingModule = function(moduleName) {
            console.log('[Preview] Registering missing module:', moduleName);
            window.__ERROR_REGISTRY.missingModules.add(moduleName);
            window.__ERROR_REGISTRY.sendErrorsToParent();
          };
          
          window.registerMissingPackage = function(packageName) {
            console.log('[Preview] Registering missing package:', packageName);
            window.__ERROR_REGISTRY.missingPackages.add(packageName);
            window.__ERROR_REGISTRY.sendErrorsToParent();
          };
          
          window.registerMissingComponent = function(componentName) {
            console.log('[Preview] Registering missing component:', componentName);
            window.__ERROR_REGISTRY.missingComponents.add(componentName);
            window.__ERROR_REGISTRY.sendErrorsToParent();
          };
          
          // Global error handler for runtime errors
          window.addEventListener('error', function(event) {
            console.log('[Preview] Error event:', event.message);
            
            // Check if it's likely a React component error
            if (event.message && (
                event.message.includes("is not defined") || 
                event.message.includes("is not a function") ||
                event.message.includes("Cannot read properties of undefined") ||
                event.message.includes("is not a component") ||
                event.message.includes("failed to load") ||
                event.message.includes("cannot find module")
              )) {
              // Add to error registry
              window.__ERROR_REGISTRY.runtimeErrors.add(event.message);
              window.__ERROR_REGISTRY.sendErrorsToParent();
              
              console.warn('[Preview] Runtime error caught:', event.message);
              
              // Create a placeholder for the missing component
              const errorElement = document.createElement('div');
              errorElement.style.color = 'red';
              errorElement.style.border = '1px solid red';
              errorElement.style.padding = '20px';
              errorElement.style.margin = '20px';
              errorElement.style.borderRadius = '4px';
              errorElement.innerText = 'Error: ' + event.message;
              
              // Try to replace the error location with our error element
              if (event.target && event.target !== window) {
                const parent = event.target.parentNode;
                if (parent) {
                  parent.replaceChild(errorElement, event.target);
                  event.preventDefault();
                  return false;
                }
              }
            }
          });
          
          // When all resources are loaded, check for errors and send them once
          window.addEventListener('load', function() {
            console.log('[Preview] Window loaded, checking for errors');
            
            // Wait a bit for any errors to be registered
            setTimeout(function() {
              if (!window.__ERROR_REGISTRY.hasSentInitialErrors) {
                window.__ERROR_REGISTRY.sendErrorsToParent();
                window.__ERROR_REGISTRY.hasSentInitialErrors = true;
              }
            }, 1000);
          });
          
          console.log("[Preview] Error tracking initialized");
        </script>
      </head>`);
    },
    
    // Handle end of build
    closeBundle() {
      // Log build errors when done
      console.log('Build completed with errors tracked in window.__ERROR_REGISTRY');
    }
  };
};

// Plugin to ensure builds complete even with errors
const ensureBuildCompletes = () => {
  return {
    name: 'ensure-build-completes',
    
    apply: 'build',
    
    // Override build hooks to prevent failures
    buildStart() {
      // Set to development mode for more lenient checks
      process.env.NODE_ENV = 'development';
    },
    
    // Used for more aggressive error handling
    transform(code, id) {
      // Always return valid code even if there are errors
      try {
        return { code, map: null };
      } catch (e) {
        console.error(`Error in transform for ${id}:`, e);
        return { 
          code: `
            // Replacing problematic file with stub
            console.error("Error in file ${id}, replaced with stub");
            export default function ErrorComponent() { 
              return document.createTextNode("Error in module: ${id}"); 
            }
          `, 
          map: null 
        };
      }
    },
    
    // Force build to complete despite errors
    renderChunk(code, chunk) {
      try {
        return { code, map: null };
      } catch (e) {
        console.error(`Error in chunk ${chunk.name}:`, e);
        return { 
          code: `console.error("Error in chunk: ${chunk.name}");`, 
          map: null 
        };
      }
    },
    
    // Force build to complete
    buildEnd(error) {
      if (error) {
        console.log('Errors suppressed during build:', error.message);
        return null; // Return null to suppress the error
      }
    }
  };
};

export default defineConfig({
  plugins: [
    handleTailwindArbitraryValues(), // Add this plugin first to handle Tailwind arbitrary values
    react(),
    createErrorFreeBuilder(),
    ensureBuildCompletes()
  ],
  build: {
    outDir: 'preview-dist',
    minify: false,
    sourcemap: true,
    cssMinify: false,
    
    rollupOptions: {
      onwarn() {
        // Suppress all Rollup warnings
        return;
      },
      // Disable tree-shaking to avoid unused import errors
      treeshake: false,
      preserveEntrySignatures: false
    }
  },
  
  // Updated optimizeDeps configuration for Vite 5.1+
  optimizeDeps: {
    noDiscovery: true,
    include: []
  },
  
  // Make ESBuild more lenient
  esbuild: {
    logOverride: {
      'this-is-undefined-in-esm': 'silent',
      'commonjs-variables-not-at-top-level': 'silent',
      'unused-import': 'silent',
      'unused-variable': 'silent',
      'parse-error': 'silent',
      'syntax-error': 'silent'
    },
    // Prevent syntax errors from failing the build
    legalComments: 'none',
    // Add this to make esbuild more lenient with JSX
    jsx: 'preserve'
  }
});