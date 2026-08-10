# MyBookshelf

Biblioteca pessoal multiplataforma, local-first e responsiva. Esta primeira versão reúne dashboard de leitura, biblioteca em quatro visualizações, páginas individuais, histórico, notas, metas, estatísticas e personalização completa da interface.

## Experiência

- três estilos visuais: Minimalista, Neobrutalismo e Glass;
- temas claro e escuro, com cinco opções de cor principal;
- layouts próprios para smartphone, tablet, desktop e ultrawide;
- cadastro inteligente via Open Library;
- cache offline, instalação como PWA e salvamento automático;
- registro de leitura com validação de intervalos;
- persistência estruturada em Cloudflare D1;
- arquitetura preparada para sincronização, backup, importação e integrações.
- aplicativo Android via Capacitor, com a interface e os dados essenciais armazenados no dispositivo.

## Desenvolvimento

Requer Node.js 22.13 ou superior e pnpm.

```bash
pnpm install
pnpm dev
```

Para validar a versão de produção:

```bash
pnpm build
pnpm test
```

Para atualizar o projeto Android e gerar um APK instalável:

```bash
pnpm mobile:apk
```

O APK de depuração é assinado automaticamente pelo Android SDK e fica em `android/app/build/outputs/apk/debug/`.

O nome `MyBookshelf` é provisório e está centralizado nos metadados e componentes principais para facilitar a futura alteração.
