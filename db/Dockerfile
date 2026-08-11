FROM mysql:latest

ENV MYSQL_DATABASE=betterx

COPY ./seed.sql /docker-entrypoint-initdb.d/

CMD ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci"]
