# My Apps

A phone-inspired home screen for useful everyday apps. ParkChi is the first available app: save your parked-car location, keep street-cleaning reminders, and track vehicle renewal dates. Signed-in data syncs with Firebase, with a local browser copy for quick loading and offline resilience.

The site deploys automatically to GitHub Pages whenever `main` is updated.

## Firebase and Google sign-in

1. Create a Firebase web app and enable Realtime Database in locked mode.
2. Add `ytang208.github.io` to Firebase Authentication's authorized domains.
3. Enable Google in Firebase Authentication and choose the project's support email.
4. Add the six values listed in `.env.example` as GitHub Actions secrets with the same names.
5. Publish `database.rules.json` to the Firebase project's Realtime Database rules.

Signed-in ParkChi records are stored under `users/{uid}/apps/parkchi`. This includes exact parking coordinates, notes, move-by times, compressed parking-sign photos, street reminders, and vehicle-renewal reminders. Firebase security rules limit each account to its own records.
