# 베이스 이미지: Node 22
FROM node:22

#컨테이너 안 작업 폴더
WORKDIR /app

# 의존성 먼저 복사 (캐시 활용 - package만 바뀔 때만 재설치)
COPY package*.json ./
RUN npm ci

#나머지 코드 복사 
COPY . .

# 앱이 쓰는 포트 (문서용 표시)
EXPOSE 3000

#컨테이너 시작 시 실행할 명령
CMD ["node", "server.js"]