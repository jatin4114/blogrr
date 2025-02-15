# Blogrr Frontend

A modern, responsive blogging platform frontend built with vanilla JavaScript, HTML, and CSS. Features a clean, intuitive interface with smooth animations and interactive elements.

## Features

- **Authentication System**
  - User login and registration
  - Secure token-based authentication
  - Persistent sessions

- **Blog Management**
  - Create, read, update, and delete blogs
  - Rich text content support
  - Category-based organization
  - Interactive blog cards with hover effects

- **Interactive UI Elements**
  - Animated transitions and effects
  - Responsive design for all screen sizes
  - Dynamic loading states
  - Modal views for detailed blog reading

- **Filtering & Sorting**
  - Filter blogs by category
  - Filter by date ranges
  - Sort by newest/oldest
  - Sort by comment count

- **Comments System**
  - Real-time comment updates
  - Interactive comment sections
  - Hover-to-preview comments
  - Full comment view in blog modal

- **Visual Features**
  - Animated background shapes
  - Smooth transitions
  - Loading animations
  - Responsive cards layout

## Getting Started

1. **Prerequisites**
   - Modern web browser
   - Backend server running (see backend documentation)

2. **Installation**
   ```bash
   # Clone the repository
   git clone [repository-url]
   cd blogrr-frontend

   # If using VS Code with Live Server
   # Right click on index.html and select "Open with Live Server"
   # Or simply open index.html in your browser
   ```

3. **Configuration**
   - Update the `API_BASE_URL` in `app.js` to match your backend server:
   ```javascript
   const API_BASE_URL = 'http://localhost:8000';
   ```

## Project Structure

```
blogrr-frontend/
├── index.html          # Main HTML file
├── styles.css         # Global styles and animations
├── app.js            # Application logic and API calls
└── README.md         # Documentation
```

## Key Components

- **Navigation Bar**
  - Brand logo
  - User profile section
  - Explore/My Blogs toggle
  - Logout functionality

- **Blog Cards**
  - Title and preview
  - Author information
  - Category tags
  - Comment counts
  - Edit/Delete options for authors

- **Filter Panel**
  - Category selection
  - Date range filters
  - Sorting options
  - Active filter indicators

- **Modal Views**
  - Full blog content
  - Comments section
  - Author details
  - Interactive elements

## Styling

The application uses a custom CSS framework with:
- CSS Variables for theming
- Flexbox and Grid layouts
- CSS animations and transitions
- Responsive breakpoints
- Modern glassmorphism effects

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)


## License

This project is licensed under the MIT License - see the LICENSE file for details

## Acknowledgments

- Font Awesome for icons
- Google Fonts for typography
- Modern CSS features for animations
