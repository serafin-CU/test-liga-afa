import AdminDataSources from './pages/AdminDataSources';
import AdminDevSeed from './pages/AdminDevSeed';
import AdminFantasyLedgerViewer from './pages/AdminFantasyLedgerViewer';
import AdminFantasyStatsViewer from './pages/AdminFantasyStatsViewer';
import AdminIngestionMonitor from './pages/AdminIngestionMonitor';
import AdminManualOverride from './pages/AdminManualOverride';
import AdminMatchSourceLinks from './pages/AdminMatchSourceLinks';
import AdminMatchValidation from './pages/AdminMatchValidation';
import AdminSystemTestHarness from './pages/AdminSystemTestHarness';
import AdminBadgesViewer from './pages/AdminBadgesViewer';
import SquadManagement from './pages/SquadManagement';
import Dashboard from './pages/Dashboard';
import ProdePredictions from './pages/ProdePredictions';
import SquadBuilder from './pages/SquadBuilder';
import Leaderboard from './pages/Leaderboard';
import AlbaChat from './pages/AlbaChat';
import Profile from './pages/Profile';
import __Layout from './Layout.jsx';


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
    "AdminBadgesViewer": AdminBadgesViewer,
    "SquadManagement": SquadManagement,
    "Dashboard": Dashboard,
    "ProdePredictions": ProdePredictions,
    "SquadBuilder": SquadBuilder,
    "Leaderboard": Leaderboard,
    "AlbaChat": AlbaChat,
    "Profile": Profile,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};