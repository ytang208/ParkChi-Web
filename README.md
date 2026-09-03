# My Apps

A phone-inspired home screen for useful everyday apps. ParkChi is the first available app: save your parked-car location, keep street-cleaning reminders, and track vehicle renewal dates. Data stays in the browser's local storage.

The site deploys automatically to GitHub Pages whenever `main` is updated.

## Firebase and Google sign-in

1. Create a Firebase web app and enable Realtime Database in locked mode.
2. Add `ytang208.github.io` to Firebase Authentication's authorized domains.
3. Enable Google in Firebase Authentication and choose the project's support email.
4. Add the six values listed in `.env.example` as GitHub Actions secrets with the same names.
5. Publish `database.rules.json` to the Firebase project's Realtime Database rules.

Signed-in ParkChi records are stored under `users/{uid}/apps/parkchi`. Parking-sign photos remain only on the current device so large images are never written into the database record.
