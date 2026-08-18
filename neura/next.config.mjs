/** @type {import('next').NextConfig} */
const nextConfig = {
  // O site não usa next/image: as capas do YouTube e os assets locais são
  // <img> comuns, já servidos no tamanho certo. Não há remotePatterns a
  // declarar — se um dia entrar next/image, é aqui que img.youtube.com e
  // i.ytimg.com precisam ser liberados.
};

export default nextConfig;