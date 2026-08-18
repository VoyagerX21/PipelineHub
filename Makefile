.PHONY: up down logs restart rebuild

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

restart:
	docker-compose restart

rebuild:
	docker-compose up -d --build app
