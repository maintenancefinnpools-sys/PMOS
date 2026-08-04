/**
 * Retired Job Center override.
 *
 * This file previously redefined showPmosJobEngine() after the authoritative
 * Job Center module loaded. That silently replaced the preferred interface
 * with a reduced two-operation window and a separate Auto Continue button.
 *
 * Job Center UI ownership now belongs exclusively to 07-B_Job_Center.gs.
 * Keep this file declaration-free until it is removed during final cleanup.
 */
