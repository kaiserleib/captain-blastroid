// Sector plug-ins (T21). Importing this module runs every sector folder's
// registrations (roster, behaviors, boss, scripts, systems, layers).
// GameScene and the sim harness import it for its side effects; shared
// systems never import a sector folder directly.
import './ionShoals';
import './eventHorizon';
import './pulsarNursery';
import './armada';
