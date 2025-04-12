# Blogrr Frontend

A modern, responsive blogging platform frontend built with Vite, JavaScript, HTML, and CSS. Features a clean, intuitive interface with smooth animations and interactive elements.

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
   - Node.js (v16 or newer)
   - npm or yarn
   - Backend server running (see backend documentation)

2. **Installation**
   ```bash
   # Clone the repository
   git clone [repository-url]
   cd blogrr-frontend

   # Install dependencies
   npm install
   # or
   yarn
   ```

3. **Development**
   ```bash
   # Start dev server
   npm run dev
   # or
   yarn dev
   ```

4. **Production Build**
   ```bash
   # Build for production
   npm run build
   # or
   yarn build

   # Preview production build
   npm run preview
   # or
   yarn preview
   ```

5. **Configuration**
   - Create a `.env` file in the project root
   - Set `VITE_API_URL` to your backend API URL

## Project Structure

```
blogrr-frontend/
├── public/              # Static assets
├── src/                 # Source files
│   ├── styles/          # CSS files
│   ├── app.js           # Application logic
│   └── main.js          # Entry point
├── index.html           # Main HTML file
├── vite.config.js       # Vite configuration
├── package.json         # Dependencies and scripts
└── README.md            # Documentation
```

## Docker Deployment

```bash
# Build the Docker image
docker build -t blogrr-frontend .

# Run the container
docker run -p 8080:80 -e BACKEND_API_URL=http://api.example.com blogrr-frontend
```

## License

This project is licensed under the MIT License - see the LICENSE file for details

## Acknowledgments

- Font Awesome for icons
- Google Fonts for typography
- Modern CSS features for animations
