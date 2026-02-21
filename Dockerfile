FROM nginx:alpine

COPY telegram-archive/course/en/ /usr/share/nginx/html/course/en/
COPY telegram-archive/course/uk/ /usr/share/nginx/html/course/uk/
COPY telegram-archive/course/twa/ /usr/share/nginx/html/course/twa/
COPY telegram-archive/course/index.html /usr/share/nginx/html/course/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY .htpasswd /etc/nginx/.htpasswd

EXPOSE 80
