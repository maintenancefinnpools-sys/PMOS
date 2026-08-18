# Customer Profile canonical read model

Customer Profile is a derived, read-only view. It does not become a new source of truth.

## Relationship keys

| Record | Canonical key | Source |
|---|---|---|
| Customer identity and contact data | `Customer ID` | `Customers` |
| Structured equipment profile | `Customer ID` | `PMOS Customer Equipment` |
| Route placements | `Customer ID` | `4-Week Route Template` |
| Future Calendar state | Existing PMOS identity mapping | Calendar registry and sync engine |

Names, addresses, email addresses, phone numbers, and Calendar titles are searchable attributes only. They must never be used as persistence keys when a Customer ID is available.

Customer IDs remain an internal implementation detail. Search results, profiles, and editor-facing headings identify customers by name and distinguish similar names with address and phone information rather than displaying IDs.

## Customer profile shape

The read adapter returns:

- Identity: Customer ID, first name, last name, display name, Calendar title, status
- Contact: complete service address, primary phone, email
- Service: frequency, service start date, seasonal/year-round value
- Route: every matching route layer and stop position
- Operational details: entry information and customer notes
- Equipment: structured bodies-of-water JSON plus the stored summary fallback

## UI modes and navigation

- `LOOKUP`: search → polished read-only profile → shared editor → refreshed profile
- `EDIT_SEARCH`: search → shared editor → same preserved search results
- The editor owns exactly one Customer ID and contains no customer-switching search.
- View and edit surfaces share adapters and controls where appropriate, but not a single visual layout.
- The visual system takes restrained internal-workspace cues from Finn Pools: Mulish typography, charcoal/slate structure, warm bronze actions, pale aqua accents, generous white space, and a modest company-logo treatment.
- Customer-facing winter-cover vocabulary is normalized to `Safety Cover`, `Lock-In Cover`, and `Tarp and Tube`.
- The compact maintenance line identifies frequency, applicable rotation weeks, service day(s), and the route-area description when the layer provides one. Weekly customers omit redundant week numbers.
- Equipment summaries omit assumed absences such as manual controls. They show only meaningful recorded values, including sanitization, automation model, chemistry-automation model, automatic cover, filter class, and winter-cover type.

## Deferred Google Contacts relationship

Google Contacts integration is intentionally outside the read-only profile slice. When enabled later, PMOS should store the People API contact resource name against the stable Customer ID. Add Maintenance Client and the customer editor may create or update that linked contact; Customer Profile may open it but should not silently mutate it.

## Compatibility rules

- Header aliases are read for compatibility with legacy Customers sheets.
- New writes continue using the canonical headers established by Add Maintenance Client.
- Invalid or missing equipment JSON does not prevent the customer profile from opening; the stored equipment summary is used as a fallback.
- Profile reads never migrate sheets or mutate source data.
