/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminDataSources from './pages/AdminDataSources';
import AdminDevSeed from './pages/AdminDevSeed';
import AdminFantasyLedgerViewer from './pages/AdminFantasyLedgerViewer';
import AdminFantasyStatsViewer from './pages/AdminFantasyStatsViewer';
import AdminIngestionMonitor from './pages/AdminIngestionMonitor';
import AdminManualOverride from './pages/AdminManualOverride';
import AdminMatchSourceLinks from './pages/AdminMatchSourceLinks';
import AdminMatchValidation from './pages/AdminMatchValidation';
import AdminSystemTestHarness from './pages/AdminSystemTestHarness';


export const PAGES = {
    "AdminDataSources": AdminDataSources,
    "AdminDevSeed": AdminDevSeed,
    "AdminFantasyLedgerViewer": AdminFantasyLedgerViewer,
    "AdminFantasyStatsViewer": AdminFantasyStatsViewer,
    "AdminIngestionMonitor": AdminIngestionMonitor,
    "AdminManualOverride": AdminManualOverride,
    "AdminMatchSourceLinks": AdminMatchSourceLinks,
    "AdminMatchValidation": AdminMatchValidation,
    "AdminSystemTestHarness": AdminSystemTestHarness,
}

export const pagesConfig = {
    mainPage: "AdminDataSources",
    Pages: PAGES,
};