# Venues Feature - Next Steps

This document outlines the remaining work to complete the new venue prospecting and opportunity management feature.

## 1. Build Out the Opportunity Detail Page

- **URL:** `/bands/:bandId/venues/:venueId/opportunities/:opportunityId`
- **Functionality:**
  - Display a summary of the opportunity (status, gig date, offer value).
  - Allow users to update the opportunity's status.
  - Display a chronological log of all interactions for this opportunity.
  - Include a form to add new interactions (e.g., log a call, add a note).

## 2. Implement Opportunity Creation Logic

- Wire up the "Start New Opportunity" button to a modal form.
- The form should capture the opportunity name and the first interaction.
- The POST route needs to create both the `Opportunity` and the initial `Interaction` records.

## 3. Enhance the Band-Venue Page

- The list of opportunities on `/bands/:bandId/venues/:venueId` should link to the detail pages created in step 1.
- Add visual cues for the status of each opportunity (e.g., color-coded badges).

## 4. Refine UI and User Experience

- Ensure all new pages are mobile-responsive.
- Add appropriate "Back" and navigation links.
- Improve the layout and styling of the new pages for a clean, intuitive user experience.

## 5. Testing

- Thoroughly test the creation, updating, and display of opportunities and interactions.
- Test edge cases, such as creating opportunities for bands with no venues, or venues with no opportunities.
