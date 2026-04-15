import AdminFantasyLedgerViewer from './pages/AdminFantasyLedgerViewer';
import AdminFantasyStatsViewer from './pages/AdminFantasyStatsViewer';
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
    "AdminFantasyLedgerViewer": AdminFantasyLedgerViewer,
    "AdminFantasyStatsViewer": AdminFantasyStatsViewer,
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