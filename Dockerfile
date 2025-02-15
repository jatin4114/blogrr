# Use nginx as the base image
FROM nginx:alpine

# Copy the frontend files to nginx's serving directory
COPY . /usr/share/nginx/html/

# Copy the custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 