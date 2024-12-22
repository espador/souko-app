# Functional Analysis for Souko App

## General App Functionality
- **Cross-Device Access**: The app must synchronize user data across devices, allowing seamless transitions between desktop and mobile.
- **Single Active Session**: Users can only have one active time tracking session at any given time. Starting a new session automatically stops the ongoing one.
- **Authentication Requirement**: Users must log in with Google authentication to access the app.
- **Real-Time Sync**: All actions (e.g., starting, pausing, and stopping sessions) must reflect across devices in real time.

## 1. Login Page

### Goal
- Enable users to securely log in using Google Authentication.

### Key Features
- Google Authentication via Firebase.
- Persistent session management (user stays logged in across app sessions).
- Minimalistic and visually appealing design with branding elements.

### UI Elements
- **Background**: Full-screen background image with a dark overlay.
- **Logo**: Centered logo with the text "Sou—ko*" in an elegant serif font.
- **Tagline**: Motivational text below the logo: *"Every journey begins with one moment."*
- **Google Login Button**: A button labeled "Sign in with Google" with a green Google icon.
- **Footer Indicator**: Swipe-up indicator bar for mobile interfaces.

### Functional Requirements
1. Allow users to log in using Google accounts.
2. User **must be logged in** to access any part of the app.
3. Redirect users to the homepage upon successful login.
4. Display a loading state while verifying authentication status.
5. Automatically redirect to the login page if the user is logged out or the session has expired.
6. Handle and display errors for login failures.
 
### User Flow
1. User lands on the login page.
2. Clicks "Sign in with Google."
   - **On success**: Redirect to the homepage.
   - **On failure**: Show an error message.

### Technical Requirements
- Use Firebase Authentication for Google sign-in.
- Persist user sessions using Firebase.
- Handle authentication errors gracefully.

### Error Handling
- **Authentication Failure**: Show a toast message: *"Authentication failed. Please try again."*
- **Network Error**: Retry login or display a network-related error.

### Accessibility
- ARIA labels for all interactive elements.
- High contrast for text and background.

### Acceptance Criteria
- Users can successfully log in using Google.
- Redirect to the homepage upon login.
- Show clear error messages for failures.

---

## 2. Homepage

### Goal
- Provide an overview of projects and daily tracked time. Enable users to manage projects and start/continue tracking sessions.

### Key Features
- Display current date.
- Show daily tracked time.
- List active projects.
- Floating Action Button (FAB) for session control.
- Profile dropdown menu with additional options.

### UI Elements
- **Header**:
  - Current date.
  - Profile picture opening a dropdown menu.
- **Empty State**:
  - Placeholder text: *"Every journey begins with one moment. Start tracking yours."*
  - "Track New Project" button.
- **Active State**:
  - Motivational text with daily tracked time.
  - Project list showing project icons, names, and tracked time.
- **FAB**:
  - Play icon for starting new sessions.
  - Stop icon for active sessions (opens the session without stopping it).
- **Profile Dropdown**:
  - Options for exporting data, settings, and signing out.

### Functional Requirements
- Dynamically display current date and daily progress.
- List active projects with tracked time.
- Enable session control through the FAB.
- Provide profile-related options in the dropdown menu.

### User Flow
1. User lands on the homepage.
2. Views daily progress and active projects.
3. Uses the FAB to start or open a session.
4. Accesses profile options via the dropdown menu.

### Technical Requirements
- Use Firebase Firestore for project and session data.
- Implement dynamic date and time calculations.
- Use React Router for navigation.

### Error Handling
- **No Projects**: Show placeholder text and "Track New Project" button.
- **FAB Issues**: Display errors for session start failures.

### Accessibility
- ARIA labels for all elements.
- Ensure all text is readable and buttons are touch-friendly.

### Acceptance Criteria
- Daily progress and project list are displayed dynamically.
- FAB functionality adapts to session states.
- Profile dropdown menu works as intended.

---

## 3. Create Project Page

### Goal
- Allow users to create and customize projects with name, picture, and billable status.

### Key Features
- Add project name (required).
- Upload project picture (optional).
- Toggle billable status.

### UI Elements
- **Header**: Back navigation.
- **Project Details**:
  - Picture placeholder with upload option.
  - Input field for project name.
  - Toggle for billable status.
- **Create Button**:
  - Disabled until required fields are filled.

### Functional Requirements
- Validate input fields.
- Enable project creation only with valid data.
- Save project details to the database.

### User Flow
1. User opens the "Create Project" page.
2. Adds project details (name, picture, billable status).
3. Clicks "Create Project" to save and return to the homepage.

### Technical Requirements
- Store project data in Firebase Firestore.
- Validate inputs and handle errors.

### Error Handling
- Show messages for missing or invalid inputs.
- Handle upload and save failures gracefully.

### Accessibility
- ARIA labels for all interactive elements.
- Ensure the "Create Project" button is accessible via keyboard.

### Acceptance Criteria
- Users can create projects with valid details.
- Redirect to the homepage after successful creation.

---

## 4. Time Tracking Session

### Goal
- Enable users to track time for projects with additional features like notes and billable status.

### Key Features
- Timer functionality (start, pause, stop, reset).
- Project selection.
- Add notes (140-character limit).
- Post-session summary.

### UI Elements
- **Start State**: Timer at `00:00:00`, disabled reset and pause buttons.
- **Active State**: Timer running with active reset and pause buttons.
- **Paused State**: Timer paused with resume option.
- **Finish State**: Session summary with options to reflect, start new, or return home.

### Functional Requirements
- A user can only have **one active time tracking session at any given time**.
- If a session is started on one device, it must reflect as active on all devices where the user is logged in.
- If an attempt is made to start a new session while another is active, prompt the user to stop or pause the existing session first.
- Enable timer controls.
- Allow project selection and note addition.
- Save session data to the database.

### User Flow
1. User starts the timer.
2. Tracks time and adds notes.
3. Pauses, resets, or stops the timer as needed.
4. Views the session summary.

### Technical Requirements
- Store session data in Firebase Firestore.
- Sync project details dynamically.
- Synchronize the state of the active session (start, stop, pause) across all devices in real-time using Firestore or another real-time database.
- Ensure the active session state is stored server-side to maintain consistency when switching devices.

### Error Handling
- Prevent session start without project selection.
- Handle timer and session save issues.

### Accessibility
- ARIA labels for timer controls and input fields.

### Acceptance Criteria
- Timer functionality works as expected.
- Sessions are saved and displayed accurately.

---

## 5. Project Detail Page

### Goal
- Provide an overview of a project and its sessions. Allow project editing.

### Key Features
- Display project name, image, and tracked time.
- List sessions grouped by month.
- Enable project editing.

### UI Elements
- **Header**: Back button and export icon.
- **Project Info**: Name, image, total time, and billable time.
- **Session List**: Tiles grouped by month with date and time tracked.

### Functional Requirements
- Fetch and display project details.
- Enable editing of project info.
- Group sessions dynamically.

### User Flow
1. User navigates to the project detail page.
2. Views project info and session list.
3. Edits project details or navigates to a session detail page.

### Technical Requirements
- Use Firebase Firestore for project and session data.
- Ensure dynamic grouping and sorting of sessions.

### Error Handling
- Handle missing or corrupted project data gracefully.

### Accessibility
- ARIA labels for all elements.
- Ensure all content is keyboard and screen reader accessible.

### Acceptance Criteria
- Project info and sessions are displayed accurately.
- Editing and navigation work as intended.

---

## 6. Project Session Detail Page

### Goal
- Display detailed information about a session. Allow editing and deletion.

### Key Features
- Show session details (time, project, billable status, notes).
- Enable note editing.
- Provide session deletion.

### UI Elements
- **Header**: Back button.
- **Session Info**: Start time, duration, project, and billable status.
- **Session Notes**: Editable text field.
- **Delete Button**: Confirmation pop-up required.

### Functional Requirements
- Fetch and display session details.
- Enable note editing and session deletion.

### User Flow
1. User navigates to the session detail page.
2. Views and edits session info.
3. Deletes the session if needed.

### Technical Requirements
- Use Firebase Firestore for session data.
- Handle updates and deletions dynamically.

### Error Handling
- Show messages for fetch, save, or delete errors.

### Accessibility
- ARIA labels for all elements.
- Ensure all actions are keyboard accessible.

### Acceptance Criteria
- Session details are displayed accurately.
- Notes can be edited and saved.
- Sessions can be deleted with confirmation.