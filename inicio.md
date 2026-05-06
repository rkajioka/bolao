Segue o MD único, consolidado e revisado.

````md
# MD ÚNICO — MVP Bolão da Copa do Mundo

## 1. Objetivo do Projeto

Desenvolver um MVP web para um bolão da Copa do Mundo.

O sistema NÃO deve ser uma plataforma genérica de campeonatos.  
O produto deve ser exclusivamente um bolão da Copa, com foco em:

- usuários cadastrados pelo admin;
- login e primeiro acesso;
- perfil do usuário;
- países com bandeiras;
- jogos da fase de grupos;
- jogos do mata-mata cadastrados pelo admin;
- palpites por jogo;
- palpites especiais do torneio;
- bônus para jogos do Brasil com palpite de marcadores de gols;
- pontuação automática;
- ranking geral;
- tabela dos grupos;
- modo de visualização por grupos;
- modo de visualização cronológica;
- painel administrativo mínimo;
- segurança;
- responsividade mobile.

O objetivo é entregar um MVP funcional, seguro, responsivo e fiel ao conceito definido para o bolão da Copa do Mundo.

---

# 2. Escopo Fechado do MVP

## 2.1 Deve existir no MVP

- Login com e-mail e senha.
- Usuários criados previamente pelo admin.
- Primeiro acesso com definição de senha.
- Hash de senha.
- Perfil básico com nome, função e imagem.
- Países/seleções com bandeiras.
- Cadastro de jogos da fase de grupos.
- Cadastro manual de jogos do mata-mata pelo admin.
- Visualização de jogos por grupo.
- Visualização de jogos em ordem cronológica.
- Tabela dos grupos atualizada conforme resultados reais.
- Palpites por jogo.
- Palpites especiais:
  - campeão;
  - melhor jogador;
  - artilheiro;
  - melhor goleiro.
- Bloqueio dos palpites especiais junto com o início da primeira rodada.
- Bloqueio dos palpites por jogo após início de cada jogo.
- Palpite de placar.
- Em jogos do mata-mata, palpite de quem se classifica.
- Em jogos do Brasil, palpite opcional/bonus de marcadores de gols.
- Cadastro de resultados pelo admin.
- Cadastro de quem passou no mata-mata.
- Cálculo automático de pontuação.
- Ranking geral somando:
  - pontos dos jogos;
  - pontos dos palpites especiais;
  - bônus dos jogos do Brasil.
- Layout responsivo para desktop e celular.
- Proteções básicas contra SQL Injection e acessos indevidos.

---

## 2.2 Não deve existir neste MVP

Não criar:

- múltiplos campeonatos;
- múltiplas temporadas;
- ligas privadas;
- fantasy;
- badges;
- conquistas;
- chat;
- feed social;
- pagamento;
- aplicativo mobile nativo;
- integração com API esportiva;
- dashboard analítico complexo;
- sistema genérico de competições;
- notificações avançadas;
- cadastro completo de elenco de todos os países.

O sistema é apenas um bolão da Copa do Mundo.

---

# 3. Premissa Principal

A Copa do Mundo é a única competição do sistema.

Não criar tabela de campeonatos.

Os jogos, países, grupos, palpites, resultados, ranking e configurações pertencem diretamente ao bolão da Copa.

A fase de grupos e o mata-mata devem ser tratados de forma diferente, porque possuem regras diferentes.

---

# 4. Perfis de Usuário

## 4.1 Admin

Pode:

- criar usuários;
- editar usuários;
- ativar/inativar usuários;
- resetar senha de usuários;
- cadastrar países/seleções;
- cadastrar bandeiras;
- cadastrar jogos da fase de grupos;
- cadastrar jogos do mata-mata;
- editar jogos;
- informar resultados;
- informar quem passou em jogos de mata-mata;
- finalizar jogos;
- cadastrar resultados especiais do torneio;
- configurar pontuações do bolão;
- recalcular pontuação;
- visualizar ranking geral.

---

## 4.2 Usuário comum

Pode:

- fazer login;
- configurar primeiro acesso;
- editar próprio perfil;
- visualizar jogos;
- visualizar grupos;
- visualizar tabela dos grupos;
- enviar palpites por jogo;
- enviar palpites especiais;
- em jogos do Brasil, informar marcadores de gols para bônus;
- em jogos do mata-mata, indicar quem se classifica;
- editar palpites enquanto estiverem abertos;
- visualizar sua pontuação;
- visualizar ranking geral.

---

# 5. Primeiro Acesso

Usuários não se cadastram livremente.

Fluxo:

1. Admin cria o usuário no sistema.
2. Usuário acessa com o e-mail cadastrado.
3. No primeiro acesso, o sistema obriga criação de senha.
4. O usuário confirma ou completa:
   - nome;
   - função/cargo;
   - imagem de perfil.
5. A senha é salva com hash.
6. O campo `primeiro_login` passa para `false`.
7. O usuário é redirecionado para o dashboard.

---

# 6. Recuperação de Senha

Para o MVP, implementar de forma simples.

## 6.1 Opção preferencial

Recuperação por token temporário, se envio de e-mail for viável.

Fluxo:

1. Usuário informa e-mail.
2. Sistema verifica se o e-mail existe.
3. Sistema gera token temporário.
4. Usuário redefine a senha.
5. Nova senha é salva com hash.

---

## 6.2 Opção alternativa

Caso e-mail não seja implementado agora, exibir:

"Para redefinir sua senha, entre em contato com o administrador."

Não criar fluxo complexo de recuperação neste MVP.

---

# 7. Banco de Dados

## 7.1 Tabela: usuarios

Campos mínimos:

- id;
- nome;
- email;
- senha_hash;
- funcao;
- imagem_perfil;
- tipo_usuario;
- ativo;
- primeiro_login;
- created_at;
- updated_at.

Regras:

- email único;
- senha nunca em texto puro;
- usuário inativo não pode logar;
- tipo_usuario deve aceitar:
  - admin;
  - usuario.

---

## 7.2 Tabela: paises

Campos mínimos:

- id;
- nome;
- sigla;
- bandeira_url;
- grupo;
- created_at;
- updated_at.

Regras:

- cada país deve ter nome e sigla;
- cada país deve ter bandeira;
- bandeiras devem aparecer nas telas de jogos, palpites, grupos e tabela;
- não usar escudos de federação, FIFA, Copa ou marcas oficiais;
- usar apenas bandeiras dos países;
- grupo pode ser nulo se o país estiver apenas em contexto de mata-mata futuro.

---

## 7.3 Tabela: jogos

Campos mínimos:

- id;
- fase;
- grupo;
- tipo_fase;
- pais_casa_id;
- pais_fora_id;
- data_jogo;
- placar_casa;
- placar_fora;
- teve_prorrogacao;
- foi_para_penaltis;
- penaltis_casa;
- penaltis_fora;
- classificado_id;
- finalizado;
- created_at;
- updated_at.

### Valores esperados para `tipo_fase`

- grupos;
- mata_mata.

### Valores possíveis para `fase`

Exemplos:

- Grupo A;
- Grupo B;
- Oitavas;
- Quartas;
- Semifinal;
- Disputa de terceiro lugar;
- Final.

### Regras gerais

- `grupo` é obrigatório para jogos da fase de grupos.
- `grupo` pode ser nulo para jogos do mata-mata.
- `placar_casa` e `placar_fora` representam o placar oficial do jogo.
- Em jogos do mata-mata, o admin deve informar também quem se classificou.
- Se houver prorrogação ou pênaltis, o sistema precisa registrar essa informação.
- `classificado_id` deve apontar para o país que avançou.
- `classificado_id` só é obrigatório em jogos de mata-mata que definem avanço.
- Ao finalizar ou alterar resultado, recalcular os pontos dos palpites daquele jogo.

---

## 7.4 Tabela: palpites_jogos

Campos mínimos:

- id;
- usuario_id;
- jogo_id;
- palpite_casa;
- palpite_fora;
- palpite_classificado_id;
- pontuacao_placar;
- pontuacao_resultado;
- pontuacao_classificado;
- pontuacao_marcadores_brasil;
- pontuacao_total;
- created_at;
- updated_at.

### Regras

- um usuário só pode ter um palpite por jogo;
- criar restrição única para `usuario_id + jogo_id`;
- palpite pode ser criado ou editado até antes do início do jogo;
- após o início do jogo, o palpite fica bloqueado;
- após o jogo ser finalizado, o palpite fica bloqueado definitivamente;
- `palpite_classificado_id` só é relevante para jogos do mata-mata;
- em jogos de fase de grupos, `palpite_classificado_id` deve ficar nulo ou ser ignorado;
- pontuação total do jogo deve consolidar:
  - pontos do placar;
  - pontos do resultado;
  - pontos de classificado, se mata-mata;
  - bônus de marcadores, se jogo do Brasil.

---

## 7.5 Tabela: palpites_especiais

Campos mínimos:

- id;
- usuario_id;
- campeao_id;
- melhor_jogador;
- artilheiro;
- melhor_goleiro;
- pontuacao_campeao;
- pontuacao_melhor_jogador;
- pontuacao_artilheiro;
- pontuacao_melhor_goleiro;
- pontuacao_total;
- bloqueado;
- created_at;
- updated_at.

### Regras

- `campeao_id` deve referenciar a tabela `paises`;
- `melhor_jogador`, `artilheiro` e `melhor_goleiro` podem ser texto livre no MVP;
- cada usuário só pode ter um registro de palpites especiais;
- criar restrição única para `usuario_id`;
- palpites especiais travam junto com o início da primeira rodada;
- backend deve impedir edição após bloqueio.

---

## 7.6 Tabela: resultados_especiais

Campos mínimos:

- id;
- campeao_id;
- melhor_jogador;
- artilheiro;
- melhor_goleiro;
- finalizado;
- created_at;
- updated_at.

### Função

Guardar os resultados oficiais dos palpites especiais para cálculo da pontuação.

### Regras

- apenas admin pode preencher;
- deve existir apenas um conjunto de resultados especiais para o bolão;
- ao salvar ou alterar, recalcular os pontos especiais de todos os usuários.

---

## 7.7 Tabela: marcadores_brasil_palpite

Campos mínimos:

- id;
- palpite_jogo_id;
- nome_jogador;
- quantidade_gols;
- pontuacao;
- created_at;
- updated_at.

### Função

Guardar os palpites de marcadores de gols em jogos do Brasil.

### Regras

- só deve ser permitido para jogos em que Brasil esteja envolvido;
- usuário pode informar um ou mais jogadores;
- `quantidade_gols` representa quantos gols o usuário acha que aquele jogador fará;
- o backend deve validar se o jogo realmente envolve o Brasil;
- esses palpites devem travar junto com o palpite do jogo;
- não permitir edição após início do jogo.

---

## 7.8 Tabela: marcadores_brasil_resultado

Campos mínimos:

- id;
- jogo_id;
- nome_jogador;
- quantidade_gols;
- created_at;
- updated_at.

### Função

Guardar os marcadores reais dos gols do Brasil em cada jogo.

### Regras

- apenas admin pode preencher;
- só deve existir para jogos do Brasil;
- ao salvar, recalcular o bônus de marcadores dos usuários naquele jogo;
- no MVP, jogadores podem ser texto livre;
- normalizar texto para comparação.

---

## 7.9 Tabela: configuracoes_bolao

Campos mínimos:

- id;
- data_bloqueio_palpites_especiais;
- pontos_campeao;
- pontos_melhor_jogador;
- pontos_artilheiro;
- pontos_melhor_goleiro;
- pontos_placar_exato;
- pontos_resultado_correto;
- pontos_classificado_mata_mata;
- pontos_marcador_brasil;
- pontos_marcador_brasil_com_quantidade;
- created_at;
- updated_at.

### Função

Centralizar configurações do bolão.

### Regras

- A data de bloqueio dos palpites especiais deve ser igual ao início da primeira rodada ou definida manualmente pelo admin.
- No MVP, usar como padrão o horário do primeiro jogo cadastrado.
- Os valores de pontuação devem ser configuráveis para evitar hardcode.
- Se os valores oficiais já estiverem definidos, inserir via seed inicial.

---

# 8. Fase de Grupos

## 8.1 Cadastro dos jogos

O admin deve cadastrar os jogos da fase de grupos com:

- fase;
- grupo;
- país casa;
- país fora;
- data e horário.

Exemplo:

- fase: Grupo A;
- grupo: A;
- país casa: Catar;
- país fora: Equador;
- data_jogo: data e hora do jogo.

---

## 8.2 Palpite do usuário na fase de grupos

Para cada jogo, o usuário informa:

- placar do país casa;
- placar do país fora.

Não há palpite de classificado em jogos da fase de grupos.

---

## 8.3 Resultado da fase de grupos

O admin informa:

- placar casa;
- placar fora;
- finalizado.

Ao finalizar o jogo:

- sistema calcula pontos dos palpites do jogo;
- sistema atualiza a tabela do grupo;
- sistema atualiza ranking geral.

---

## 8.4 Tabela dos grupos

A tabela do grupo deve ser calculada com base nos resultados reais dos jogos finalizados.

Campos sugeridos:

- posição;
- bandeira;
- país;
- pontos;
- jogos;
- vitórias;
- empates;
- derrotas;
- gols pró;
- gols contra;
- saldo de gols.

Ordenação:

1. pontos;
2. saldo de gols;
3. gols pró;
4. ordem alfabética como fallback simples no MVP.

Essa tabela é da Copa, não do ranking dos usuários.

---

# 9. Mata-Mata

## 9.1 Premissa

O mata-mata não deve ser gerado automaticamente no MVP.

O admin será responsável por cadastrar os jogos do mata-mata conforme os confrontos forem definidos.

Motivo:

- reduz complexidade;
- evita depender de regras completas de chaveamento;
- permite MVP mais seguro;
- evita erro automático em classificação.

---

## 9.2 Cadastro de jogos do mata-mata

O admin deve cadastrar manualmente:

- fase;
- país casa;
- país fora;
- data e horário.

Exemplos de fase:

- Oitavas;
- Quartas;
- Semifinal;
- Disputa de terceiro lugar;
- Final.

O campo `tipo_fase` deve ser `mata_mata`.

---

## 9.3 Palpite do usuário no mata-mata

Em jogos do mata-mata, o usuário deve informar:

- placar do jogo;
- quem se classifica/passará de fase.

Campos do palpite:

- palpite_casa;
- palpite_fora;
- palpite_classificado_id.

### Observação importante

O placar pode ser empate em mata-mata se o usuário acredita que a decisão será nos pênaltis.

Por isso, o palpite de classificado é obrigatório em jogos do mata-mata.

Exemplo:

Brasil 1 x 1 Argentina  
Classificado: Brasil

Isso indica que o usuário acredita em empate no placar e Brasil avançando, possivelmente por pênaltis.

---

## 9.4 Resultado real do mata-mata

O admin deve informar:

- placar casa;
- placar fora;
- se teve prorrogação;
- se foi para pênaltis;
- placar dos pênaltis, se houver;
- quem se classificou;
- finalizado.

Campos relevantes:

- placar_casa;
- placar_fora;
- teve_prorrogacao;
- foi_para_penaltis;
- penaltis_casa;
- penaltis_fora;
- classificado_id;
- finalizado.

---

## 9.5 Regra de classificação no mata-mata

O sistema não deve tentar inferir de forma cega quem passou apenas pelo placar.

O admin deve informar explicitamente `classificado_id`.

Motivo:

- pode haver empate no tempo normal/prorrogação;
- pode haver pênaltis;
- evita erro de cálculo;
- deixa a regra clara.

---

## 9.6 Pontuação no mata-mata

A pontuação do mata-mata deve considerar:

- pontuação do placar;
- pontuação do resultado;
- pontuação por acertar quem passou/classificou.

A regra exata de pontuação deve seguir a regra oficial do bolão.

Os valores devem ser configuráveis em `configuracoes_bolao`.

Não hardcodar a regra diretamente nas rotas.

---

# 10. Palpites Especiais do Torneio

Além dos palpites por jogo, o usuário deve preencher palpites especiais:

- campeão;
- melhor jogador;
- artilheiro;
- melhor goleiro.

Esses palpites devem aparecer em uma seção própria.

Pode ser:

- uma tela chamada "Palpites Especiais";
- ou um bloco no Dashboard com link para edição.

Para o MVP, recomenda-se tela própria.

---

## 10.1 Campos da tela de palpites especiais

### Campeão

Campo do tipo select/dropdown com os países cadastrados.

Deve exibir:

- bandeira;
- nome do país;
- sigla, se fizer sentido visualmente.

### Melhor jogador

Campo texto livre no MVP.

### Artilheiro

Campo texto livre no MVP.

### Melhor goleiro

Campo texto livre no MVP.

---

## 10.2 Bloqueio dos palpites especiais

Os palpites especiais devem ser travados junto com a primeira rodada.

Regra:

- antes da data/hora de bloqueio, o usuário pode criar ou editar;
- após a data/hora de bloqueio, os campos ficam somente leitura;
- backend deve impedir alterações após o bloqueio;
- frontend deve apenas refletir o bloqueio visualmente.

### Regra de bloqueio

A data de bloqueio dos palpites especiais deve ser definida assim:

1. Se existir configuração manual em `configuracoes_bolao.data_bloqueio_palpites_especiais`, usar essa data.
2. Se não existir, usar a data/hora do primeiro jogo cadastrado.
3. Após essa data, todos os palpites especiais ficam bloqueados.

---

## 10.3 Pontuação dos palpites especiais

Os palpites especiais possuem pontuação própria.

A pontuação deve ser configurável no banco:

- pontos_campeao;
- pontos_melhor_jogador;
- pontos_artilheiro;
- pontos_melhor_goleiro.

Quando o admin cadastrar os resultados especiais:

1. buscar todos os palpites especiais dos usuários;
2. comparar cada palpite com o resultado oficial;
3. calcular a pontuação individual de cada categoria;
4. preencher:
   - pontuacao_campeao;
   - pontuacao_melhor_jogador;
   - pontuacao_artilheiro;
   - pontuacao_melhor_goleiro;
   - pontuacao_total;
5. atualizar o ranking geral.

---

## 10.4 Comparação de textos

Para melhor jogador, artilheiro e melhor goleiro:

- normalizar texto antes de comparar;
- remover espaços extras;
- ignorar diferença entre maiúsculas e minúsculas;
- remover acentos.

Exemplo:

"Vinicius Junior" deve poder bater com "Vinícius Júnior".

No MVP, implementar pelo menos:

- trim;
- lowercase;
- remoção básica de acentos.

---

# 11. Bônus de Marcadores em Jogos do Brasil

## 11.1 Premissa

Em jogos do Brasil, o usuário poderá informar marcadores de gols como bônus de pontuação.

Esse bônus é adicional ao palpite do placar.

Exemplo:

Jogo: Brasil x Sérvia

Usuário informa:

- placar: Brasil 2 x 0 Sérvia;
- marcadores do Brasil:
  - Vinícius Jr. — 1 gol;
  - Rodrygo — 1 gol.

---

## 11.2 Quando exibir o campo de marcadores

O campo de marcadores deve aparecer apenas se o jogo envolver o Brasil.

Critério:

- país casa é Brasil; ou
- país fora é Brasil.

Se o jogo não envolver o Brasil, não exibir seção de marcadores.

---

## 11.3 Como o usuário informa os marcadores

Para o MVP, usar texto livre.

Cada marcador deve ter:

- nome do jogador;
- quantidade de gols.

Não criar cadastro completo de elenco no MVP.

Interface sugerida:

- botão "Adicionar marcador";
- campo "Nome do jogador";
- campo "Gols";
- botão para remover marcador antes do bloqueio.

---

## 11.4 Bloqueio dos marcadores

Os palpites de marcadores devem travar junto com o jogo.

Regra:

- antes de `data_jogo`, usuário pode criar ou editar;
- após `data_jogo`, usuário não pode alterar;
- se o jogo estiver finalizado, não pode alterar;
- backend deve validar o bloqueio;
- frontend apenas reflete o estado.

---

## 11.5 Resultado dos marcadores

O admin deve informar os marcadores reais dos gols do Brasil.

Para cada jogo do Brasil:

- nome do jogador;
- quantidade de gols.

Exemplo:

Brasil 3 x 1 Japão

Marcadores reais:

- Neymar — 1;
- Vinícius Jr. — 1;
- Bruno Guimarães — 1.

---

## 11.6 Pontuação dos marcadores

A pontuação dos marcadores deve ser configurável.

Campos sugeridos em `configuracoes_bolao`:

- pontos_marcador_brasil;
- pontos_marcador_brasil_com_quantidade.

Interpretação sugerida:

- `pontos_marcador_brasil`: pontos por acertar que o jogador marcou ao menos um gol;
- `pontos_marcador_brasil_com_quantidade`: pontos por acertar exatamente a quantidade de gols daquele jogador.

A regra exata deve seguir a pontuação oficial definida pelo bolão.

Não hardcodar valores nas rotas.

---

## 11.7 Comparação de nomes dos marcadores

Como no MVP os jogadores serão texto livre, normalizar nomes antes da comparação:

- remover espaços extras;
- lowercase;
- remover acentos.

Exemplo:

"Vinicius Junior" deve bater com "Vinícius Júnior".

---

# 12. Pontuação Geral do Bolão

O ranking geral deve considerar:

```text
pontuação total do usuário =
soma dos pontos dos palpites de jogos
+
pontuação dos palpites especiais
+
bônus de marcadores dos jogos do Brasil
````

Não criar tabela de ranking no MVP.

O ranking deve ser calculado por query agregada ou service.

A lógica deve ficar em:

`services/ranking_service.py`

---

# 13. Pontuação dos Jogos

A pontuação dos jogos deve seguir exatamente a regra oficial definida para este bolão.

A lógica deve ficar isolada em:

`services/pontuacao_service.py`

Funções sugeridas:

```python
calcular_pontuacao_jogo(palpite, resultado)
calcular_pontuacao_mata_mata(palpite, resultado)
calcular_pontuacao_especial(palpite_especial, resultado_especial, configuracao)
calcular_pontuacao_marcadores_brasil(palpite_marcadores, resultado_marcadores, configuracao)
```

Não espalhar regra de pontuação dentro das rotas.

Não inventar pontuação genérica se a regra oficial já tiver sido definida.

Os valores devem ser configuráveis no banco.

---

# 14. Visualização dos Jogos

O usuário deve ter dois modos principais de lançar palpites.

---

## 14.1 Modo 1 — Por Grupos

A tela deve organizar os jogos por grupo:

* Grupo A;
* Grupo B;
* Grupo C;
* etc.

Cada grupo deve mostrar:

* jogos do grupo;
* bandeiras dos países;
* campos de palpite;
* data e horário;
* status do jogo;
* tabela atualizada do grupo.

Esse modo é voltado para visão da estrutura da Copa.

---

## 14.2 Modo 2 — Ordem Cronológica

Criar uma tela ou aba para lançar palpites em ordem cronológica.

Objetivo:

Facilitar o preenchimento rápido dos palpites.

A tela deve listar todos os jogos ordenados por data e horário.

Cada item deve mostrar:

* data;
* horário;
* fase;
* grupo, se houver;
* bandeira do país da casa;
* seleção casa;
* campo de palpite da casa;
* campo de palpite de fora;
* seleção fora;
* bandeira do país de fora;
* status do palpite.

Se for mata-mata, também mostrar:

* campo "quem se classifica".

Se for jogo do Brasil, também mostrar:

* seção de marcadores de gols.

Regras:

* palpite salvo no modo cronológico deve aparecer no modo por grupo;
* palpite salvo no modo por grupo deve aparecer no modo cronológico;
* os dois modos usam a mesma tabela `palpites_jogos`;
* não duplicar dados.

---

# 15. Status dos Jogos e Palpites

## 15.1 Aberto

Condição:

* data atual menor que `data_jogo`;
* jogo não finalizado.

Comportamento:

* usuário pode criar ou editar palpite;
* se jogo do Brasil, pode criar ou editar marcadores;
* se mata-mata, pode escolher ou alterar classificado.

---

## 15.2 Bloqueado

Condição:

* data atual maior ou igual a `data_jogo`;
* jogo ainda não finalizado.

Comportamento:

* usuário vê o palpite salvo;
* usuário vê marcadores salvos, se houver;
* usuário não pode editar.

---

## 15.3 Finalizado

Condição:

* admin informou resultado;
* jogo foi marcado como finalizado.

Comportamento:

* usuário vê resultado real;
* usuário vê seu palpite;
* em mata-mata, usuário vê quem passou;
* em jogos do Brasil, usuário vê marcadores reais;
* usuário vê pontuação recebida;
* campos ficam bloqueados.

---

# 16. Telas do MVP

## 16.1 Login

Campos:

* e-mail;
* senha.

Ações:

* entrar;
* esqueci minha senha.

Validações:

* e-mail obrigatório;
* senha obrigatória;
* usuário precisa existir;
* usuário precisa estar ativo.

---

## 16.2 Primeiro Acesso

Campos:

* nome;
* função;
* imagem de perfil;
* nova senha;
* confirmar senha.

Regras:

* senha e confirmação devem coincidir;
* senha deve ser salva com hash;
* marcar `primeiro_login` como false.

---

## 16.3 Dashboard

Tela simples.

Mostrar:

* saudação com nome;
* pontuação atual;
* posição no ranking;
* próximo jogo aberto para palpite;
* status dos palpites especiais;
* atalho para palpites por grupos;
* atalho para palpites cronológicos;
* atalho para ranking.

Não criar dashboard analítico complexo.

---

## 16.4 Palpites Especiais

Tela para preencher:

* campeão;
* melhor jogador;
* artilheiro;
* melhor goleiro.

Estados:

* aberto para edição;
* bloqueado após início da primeira rodada;
* finalizado após admin cadastrar resultados especiais.

Quando finalizado, mostrar:

* palpite do usuário;
* resultado oficial;
* pontos recebidos por categoria;
* pontuação total dos palpites especiais.

---

## 16.5 Palpites por Grupo

Tela com:

* agrupamento por grupo;
* cards ou linhas de jogos;
* bandeiras;
* campos de palpite;
* tabela do grupo;
* status do jogo/palpite.

Essa tela deve focar a fase de grupos.

Jogos de mata-mata podem ficar fora dessa tela ou em uma seção separada, pois não pertencem a grupos.

---

## 16.6 Palpites em Ordem Cronológica

Tela com:

* lista de jogos por data;
* preenchimento rápido;
* bandeiras;
* campos de placar;
* campo de classificado quando for mata-mata;
* campo de marcadores quando for jogo do Brasil;
* status;
* botão salvar por jogo.

Essa tela deve incluir tanto fase de grupos quanto mata-mata.

---

## 16.7 Ranking

Tabela ou cards com:

* posição;
* avatar;
* nome;
* função;
* pontos dos jogos;
* pontos especiais;
* bônus Brasil;
* pontuação total.

No MVP, se quiser simplificar visualmente, pode exibir apenas:

* posição;
* avatar;
* nome;
* pontuação total.

Mas o backend deve calcular separadamente:

* pontos dos jogos;
* pontos especiais;
* bônus Brasil;
* total geral.

---

## 16.8 Perfil

Usuário pode editar:

* nome;
* função;
* imagem de perfil;
* senha.

Usuário comum não pode editar:

* e-mail;
* tipo de usuário;
* status ativo/inativo.

---

## 16.9 Admin — Usuários

Funcionalidades:

* listar usuários;
* criar usuário;
* editar nome;
* editar e-mail;
* editar função;
* definir tipo de usuário;
* ativar/inativar usuário;
* resetar senha.

---

## 16.10 Admin — Países

Funcionalidades:

* listar países;
* cadastrar país;
* editar país;
* definir grupo;
* definir bandeira.

---

## 16.11 Admin — Jogos

Funcionalidades:

* listar jogos;
* criar jogo;
* editar jogo;
* definir tipo de fase:

  * grupos;
  * mata_mata;
* informar resultado;
* informar se teve prorrogação;
* informar se foi para pênaltis;
* informar placar dos pênaltis, se houver;
* informar classificado em jogos de mata-mata;
* marcar como finalizado;
* recalcular pontuação dos palpites daquele jogo;
* atualizar tabela do grupo automaticamente quando for fase de grupos.

---

## 16.12 Admin — Marcadores Brasil

Funcionalidades:

* listar jogos do Brasil;
* cadastrar marcadores reais;
* editar marcadores reais;
* recalcular bônus dos usuários naquele jogo.

Campos:

* jogo;
* nome do jogador;
* quantidade de gols.

---

## 16.13 Admin — Resultados Especiais

Funcionalidades:

* informar campeão;
* informar melhor jogador;
* informar artilheiro;
* informar melhor goleiro;
* salvar resultados especiais;
* recalcular pontuação especial dos usuários.

---

## 16.14 Admin — Configurações do Bolão

Funcionalidades mínimas:

* definir data de bloqueio dos palpites especiais;
* definir pontuação de campeão;
* definir pontuação de melhor jogador;
* definir pontuação de artilheiro;
* definir pontuação de melhor goleiro;
* definir pontuação de placar exato;
* definir pontuação de resultado correto;
* definir pontuação de classificado no mata-mata;
* definir pontuação de marcador do Brasil;
* definir pontuação de marcador com quantidade exata.

Para simplificar o MVP, essas configurações podem ser inseridas via seed ou tela admin simples.

---

# 17. Design e Interface

Preservar o design já definido anteriormente.

Não criar novo conceito visual.

Diretrizes:

* visual moderno;
* limpo;
* esportivo, mas sem exagero;
* cards para jogos;
* bandeiras bem visíveis;
* campos de placar fáceis de preencher;
* tela de grupos organizada;
* ranking claro;
* admin simples;
* sem excesso de cores;
* sem animações desnecessárias;
* sem poluição visual.

Não transformar em dashboard corporativo.

Não transformar em app de gamificação avançada.

---

# 18. Responsividade Mobile

O sistema deve funcionar bem em celular.

Isso é obrigatório no MVP.

## 18.1 Regras gerais

* layout responsivo;
* não depender de hover;
* botões confortáveis para toque;
* campos de placar grandes o suficiente;
* cards empilhados verticalmente;
* tabelas largas com scroll horizontal ou versão compacta.

---

## 18.2 Mobile — Palpites por Jogo

No celular:

* cada jogo deve aparecer como card;
* bandeiras e nomes devem ser legíveis;
* campos de placar devem ser fáceis de tocar;
* status deve ser claro;
* evitar tabela larga para preenchimento.

---

## 18.3 Mobile — Mata-Mata

No celular:

* campo de classificado deve ser claro;
* usar select/dropdown com bandeira e nome do país;
* mostrar se o jogo está aberto, bloqueado ou finalizado;
* se houver pênaltis no resultado, exibir de forma compacta.

---

## 18.4 Mobile — Marcadores Brasil

No celular:

* seção de marcadores deve ser recolhível ou compacta;
* botão "Adicionar marcador" deve ser fácil de tocar;
* campos de nome e quantidade devem ficar empilhados;
* evitar layout largo.

---

## 18.5 Mobile — Palpites Especiais

No celular:

* campos devem ficar empilhados;
* dropdown de campeão deve ser fácil de usar;
* status de bloqueio deve ser claro;
* pontuação especial deve aparecer de forma compacta quando calculada.

---

## 18.6 Mobile — Tabela de Grupo

Versão compacta deve exibir prioritariamente:

* posição;
* bandeira;
* país;
* pontos;
* saldo de gols.

Campos adicionais podem ficar em scroll horizontal ou expansão.

---

## 18.7 Mobile — Ranking

Ranking deve ser adaptado para card ou tabela compacta.

Mostrar prioritariamente:

* posição;
* avatar;
* nome;
* pontos.

---

# 19. Segurança

Segurança é obrigatória no MVP.

---

## 19.1 Autenticação

Obrigatório:

* JWT;
* hash de senha com bcrypt/passlib;
* senha nunca salva em texto puro;
* rotas privadas protegidas;
* usuário inativo não pode logar;
* primeiro_login deve bloquear acesso normal até conclusão.

---

## 19.2 Autorização

Obrigatório:

* usuário comum não pode acessar rotas admin;
* backend deve validar permissões;
* frontend pode esconder botões, mas a proteção real é no backend;
* endpoints admin devem exigir `tipo_usuario = admin`.

---

## 19.3 SQL Injection

Obrigatório prevenir SQL Injection.

Regras:

* não montar SQL com concatenação de strings;
* não interpolar valores diretamente em queries;
* usar SQLAlchemy ORM ou queries parametrizadas;
* validar inputs com Pydantic;
* nunca confiar em parâmetros vindos do frontend;
* aplicar restrições no banco.

Exemplo proibido:

```python
query = "SELECT * FROM usuarios WHERE email = '" + email + "'"
```

Exemplo correto:

```python
db.query(Usuario).filter(Usuario.email == email).first()
```

---

## 19.4 Validação Backend

O backend deve validar:

* e-mail válido;
* senha obrigatória;
* usuário ativo;
* tipo de usuário;
* jogo existente;
* país existente;
* palpite numérico;
* palpite não negativo;
* palpite único por usuário/jogo;
* prazo do jogo antes de permitir edição;
* prazo dos palpites especiais;
* se jogo é do Brasil antes de aceitar marcadores;
* se jogo é mata-mata antes de aceitar classificado;
* resultado apenas por admin;
* resultado numérico e não negativo;
* usuário comum não altera pontuação manualmente;
* usuário comum não altera palpite de outro usuário.

---

## 19.5 Proteção dos Palpites Especiais

O backend deve impedir:

* editar campeão após bloqueio;
* editar melhor jogador após bloqueio;
* editar artilheiro após bloqueio;
* editar melhor goleiro após bloqueio;
* usuário criar mais de um registro de palpite especial;
* usuário alterar resultado especial;
* usuário alterar sua própria pontuação especial.

---

## 19.6 Proteção dos Palpites de Mata-Mata

O backend deve impedir:

* usuário informar classificado em jogo que não é mata-mata;
* usuário editar classificado após início do jogo;
* usuário escolher país que não participa do jogo;
* admin finalizar jogo de mata-mata sem informar classificado.

---

## 19.7 Proteção dos Marcadores Brasil

O backend deve impedir:

* usuário informar marcador em jogo que não envolve Brasil;
* usuário editar marcador após início do jogo;
* usuário criar marcador com quantidade negativa;
* usuário alterar marcador de outro usuário;
* usuário alterar pontuação do marcador;
* usuário alterar marcador real cadastrado pelo admin.

---

## 19.8 Upload de Imagem

Caso exista upload de imagem:

* validar extensão;
* validar tamanho máximo;
* não executar arquivos enviados;
* salvar em pasta controlada;
* gerar nome seguro;
* não aceitar path enviado pelo usuário.

Para MVP, se upload for complexo, pode começar com URL/avatar.

---

# 20. Backend — Rotas Mínimas

## 20.1 Auth

* POST /auth/login
* GET /auth/me
* POST /auth/primeiro-acesso
* POST /auth/change-password
* POST /auth/forgot-password, se aplicável
* POST /auth/reset-password, se aplicável

---

## 20.2 Usuários

Restrito ao admin:

* GET /usuarios
* POST /usuarios
* GET /usuarios/{id}
* PUT /usuarios/{id}
* PATCH /usuarios/{id}/status
* PATCH /usuarios/{id}/reset-password

---

## 20.3 Países

Autenticado:

* GET /paises

Restrito ao admin:

* POST /paises
* PUT /paises/{id}

---

## 20.4 Jogos

Autenticado:

* GET /jogos
* GET /jogos/cronologico
* GET /jogos/grupos
* GET /jogos/mata-mata
* GET /jogos/brasil

Restrito ao admin:

* POST /jogos
* PUT /jogos/{id}
* PATCH /jogos/{id}/resultado
* PATCH /jogos/{id}/finalizar

---

## 20.5 Palpites de Jogos

Autenticado:

* GET /palpites-jogos/me
* POST /palpites-jogos
* PUT /palpites-jogos/{id}

Regras:

* usuário só acessa seus palpites;
* backend valida horário do jogo;
* backend valida duplicidade;
* backend impede alteração de palpite de outro usuário.

---

## 20.6 Palpites Especiais

Autenticado:

* GET /palpites-especiais/me
* POST /palpites-especiais
* PUT /palpites-especiais/me

Restrito ao admin:

* GET /palpites-especiais
* PATCH /palpites-especiais/recalcular

---

## 20.7 Marcadores Brasil

Autenticado:

* GET /marcadores-brasil/me/{jogo_id}
* POST /marcadores-brasil/{jogo_id}
* PUT /marcadores-brasil/{jogo_id}

Restrito ao admin:

* GET /marcadores-brasil/admin/{jogo_id}
* POST /marcadores-brasil/resultado/{jogo_id}
* PUT /marcadores-brasil/resultado/{jogo_id}
* PATCH /marcadores-brasil/recalcular/{jogo_id}

---

## 20.8 Resultados Especiais

Restrito ao admin:

* GET /resultados-especiais
* POST /resultados-especiais
* PUT /resultados-especiais
* PATCH /resultados-especiais/finalizar

---

## 20.9 Grupos

Autenticado:

* GET /grupos
* GET /grupos/{grupo}/tabela

---

## 20.10 Ranking

Autenticado:

* GET /ranking

---

## 20.11 Configurações do Bolão

Restrito ao admin:

* GET /configuracoes-bolao
* PUT /configuracoes-bolao

---

# 21. Backend — Organização Recomendada

Estrutura sugerida:

```text
app/
  main.py
  database.py
  models/
  schemas/
  routes/
  services/
  auth/
  utils/
```

Services importantes:

* auth_service.py
* usuario_service.py
* pais_service.py
* jogo_service.py
* palpite_jogo_service.py
* palpite_especial_service.py
* marcador_brasil_service.py
* pontuacao_service.py
* grupo_service.py
* ranking_service.py
* configuracao_bolao_service.py

Regras:

* rotas não devem concentrar regra de negócio;
* pontuação deve ficar em service;
* tabela de grupo deve ficar em service;
* ranking deve ficar em service;
* bloqueios devem ser validados no backend;
* regras de mata-mata devem ficar em service;
* regras de marcadores do Brasil devem ficar em service.

---

# 22. Frontend — Organização Recomendada

Estrutura sugerida:

```text
src/
  pages/
  components/
  services/
  context/
  routes/
  styles/
```

Páginas mínimas:

* Login
* PrimeiroAcesso
* Dashboard
* PalpitesGrupos
* PalpitesCronologico
* PalpitesEspeciais
* Ranking
* Perfil
* AdminUsuarios
* AdminPaises
* AdminJogos
* AdminMarcadoresBrasil
* AdminResultadosEspeciais
* AdminConfiguracoesBolao

Componentes úteis:

* GameCard
* KnockoutGameCard
* BrazilScorersInput
* Flag
* GuessInput
* QualifiedTeamSelect
* GroupTable
* RankingTable
* UserAvatar
* SpecialGuessForm
* ProtectedRoute
* AdminRoute

---

# 23. Comportamento Esperado dos Palpites

## 23.1 Sincronização entre modos

O sistema deve ter dois modos de visualização de jogos, mas apenas uma fonte de dados.

Se o usuário criar ou editar palpite no modo cronológico, o mesmo palpite deve aparecer no modo por grupo.

Se o usuário criar ou editar palpite no modo por grupo, o mesmo palpite deve aparecer no modo cronológico.

Não duplicar dados.

---

## 23.2 Salvamento

Para o MVP, usar botão salvar por jogo.

Motivo:

* reduz risco;
* deixa feedback claro;
* facilita debug.

O botão deve indicar:

* salvando;
* salvo com sucesso;
* erro ao salvar;
* bloqueado.

---

## 23.3 Estados visuais

Cada jogo deve indicar:

* sem palpite;
* palpite salvo;
* aberto;
* bloqueado;
* finalizado;
* pontuação calculada.

Cada palpite especial deve indicar:

* não preenchido;
* salvo;
* editável;
* bloqueado;
* pontuação calculada.

Cada jogo do Brasil deve indicar:

* sem marcador informado;
* marcador salvo;
* marcador bloqueado;
* bônus calculado.

Cada jogo de mata-mata deve indicar:

* classificado não escolhido;
* classificado escolhido;
* classificado bloqueado;
* pontuação de classificado calculada.

---

# 24. Ranking

O ranking geral deve considerar:

* pontuação dos palpites de jogos;
* pontuação dos palpites especiais;
* bônus dos marcadores do Brasil;
* pontuação total.

Campos sugeridos:

* posição;
* avatar;
* nome;
* função;
* pontos dos jogos;
* pontos especiais;
* bônus Brasil;
* pontos totais.

Ordenação:

1. maior pontuação total;
2. critério de desempate oficial, se existir;
3. ordem alfabética como fallback simples.

Não criar tabela de ranking no MVP.

---

# 25. Critérios de Aceite

O MVP só estará pronto quando:

* admin conseguir criar usuários;
* usuário conseguir fazer primeiro acesso;
* senha for salva com hash;
* usuário conseguir completar perfil;
* usuário conseguir logar depois do primeiro acesso;
* países tiverem bandeiras;
* admin conseguir cadastrar jogos da fase de grupos;
* admin conseguir cadastrar jogos do mata-mata;
* usuário conseguir visualizar jogos por grupo;
* usuário conseguir visualizar jogos em ordem cronológica;
* usuário conseguir lançar palpites nos dois modos;
* usuário conseguir lançar palpites especiais;
* usuário conseguir escolher classificado em jogos de mata-mata;
* usuário conseguir informar marcadores de gols em jogos do Brasil;
* palpites especiais travarem junto com a primeira rodada;
* palpites de jogos travarem no início de cada jogo;
* palpites de marcadores travarem no início do jogo do Brasil;
* os dois modos de jogos exibirem os mesmos palpites sincronizados;
* admin conseguir informar resultados dos jogos;
* admin conseguir informar prorrogação e pênaltis quando houver;
* admin conseguir informar quem passou no mata-mata;
* admin conseguir informar marcadores reais dos jogos do Brasil;
* admin conseguir informar resultados especiais;
* sistema calcular pontuação dos jogos;
* sistema calcular pontuação dos classificados no mata-mata;
* sistema calcular bônus dos marcadores do Brasil;
* sistema calcular pontuação dos palpites especiais;
* tabela dos grupos atualizar conforme resultados reais;
* ranking geral somar jogos + especiais + bônus Brasil;
* usuário comum não conseguir acessar funções admin;
* backend estiver protegido contra SQL Injection;
* inputs forem validados no backend;
* sistema funcionar em desktop e celular;
* visual seguir o design já escolhido;
* nenhuma funcionalidade fora do MVP for criada.

---

# 26. Ordem de Implementação

## Etapa 1 — Base Técnica

* criar backend;
* configurar PostgreSQL;
* criar models;
* criar schemas;
* configurar JWT;
* configurar hash de senha;
* estruturar proteção contra SQL Injection usando ORM/queries parametrizadas.

---

## Etapa 2 — Usuários e Login

* CRUD admin de usuários;
* login;
* primeiro acesso;
* alteração de senha;
* proteção de rotas;
* bloqueio de usuário inativo.

---

## Etapa 3 — Países e Bandeiras

* criar tabela de países;
* cadastrar seleções;
* definir grupos;
* vincular bandeiras;
* exibir bandeiras no frontend.

---

## Etapa 4 — Jogos da Fase de Grupos

* CRUD admin de jogos;
* vincular jogos aos países;
* listar jogos por grupo;
* listar jogos em ordem cronológica.

---

## Etapa 5 — Jogos do Mata-Mata

* permitir admin cadastrar jogos do mata-mata;
* permitir informar classificado;
* permitir registrar prorrogação;
* permitir registrar pênaltis;
* adaptar palpite do usuário para escolher classificado.

---

## Etapa 6 — Palpites de Jogos

* criar palpite;
* editar palpite;
* bloquear após início do jogo;
* impedir duplicidade;
* sincronizar modos de visualização.

---

## Etapa 7 — Palpites Especiais

* criar tela de palpites especiais;
* salvar campeão;
* salvar melhor jogador;
* salvar artilheiro;
* salvar melhor goleiro;
* bloquear junto com primeira rodada;
* validar bloqueio no backend.

---

## Etapa 8 — Marcadores Brasil

* identificar jogos do Brasil;
* exibir campos de marcadores apenas nesses jogos;
* permitir usuário salvar marcadores;
* bloquear junto com início do jogo;
* permitir admin cadastrar marcadores reais;
* calcular bônus.

---

## Etapa 9 — Tabelas dos Grupos

* calcular tabela por grupo com base nos resultados reais;
* atualizar após resultado salvo;
* exibir tabela na tela de grupos;
* adaptar tabela para mobile.

---

## Etapa 10 — Pontuação

* implementar pontuação oficial dos jogos;
* implementar pontuação de classificado no mata-mata;
* implementar pontuação dos palpites especiais;
* implementar bônus de marcadores do Brasil;
* recalcular ao salvar resultado;
* salvar pontuação nos palpites;
* garantir função isolada em service.

---

## Etapa 11 — Ranking

* calcular soma dos pontos dos jogos;
* calcular soma dos pontos especiais;
* calcular bônus Brasil;
* exibir pontuação total;
* adaptar ranking para mobile.

---

## Etapa 12 — Responsividade e UX

* ajustar telas para celular;
* revisar cards de jogos;
* revisar tela de palpites especiais;
* revisar campos de mata-mata;
* revisar campos de marcadores Brasil;
* revisar tabela de grupos;
* revisar ranking;
* revisar botões e inputs para toque;
* evitar layout quebrado em telas pequenas.

---



* testar permissões;
* testar bloqueio de palpites por jogo;
* testar bloqueio de palpites especiais;
* testar bloqueio de marcadores Brasil;
* testar SQL Injection ;
* testar usuário comum tentando acessar admin;
* testar alteração de resultado;
* testar recálculo de pontos;
* testar mata-mata com prorrogação;
* testar mata-mata com pênaltis;
* testar ranking;
* testar responsividade.

---

# 27. Instrução Final Para a IA/Desenvolvedor

Implemente apenas este MVP.

Não crie plataforma genérica.

Não crie múltiplos campeonatos.

Não ignore fase de grupos.

Não ignore mata-mata.

Não tente gerar automaticamente os confrontos do mata-mata no MVP.

Não permita finalizar jogo de mata-mata sem informar quem passou.

Não ignore prorrogação e pênaltis.

Não ignore os palpites especiais.

Não permita editar palpites especiais depois do início da primeira rodada.

Não ignore bônus de marcadores em jogos do Brasil.

Não permita marcadores em jogos que não envolvam Brasil.

Não invente regra de pontuação diferente da definida para o bolão.

Não altere o design já escolhido.

Não ignore responsividade mobile.

Não ignore segurança.

Não ignore bandeiras dos países.

Não ignore visualização por grupos.

Não ignore visualização cronológica.

Não ignore tabela dos grupos.

O objetivo é entregar um MVP funcional, seguro, responsivo e fiel ao conceito definido para o bolão da Copa do Mundo.

```

Ponto crítico: agora o MD está estruturalmente completo, mas ainda falta inserir os valores oficiais de pontuação. Eu deixei todos os pontos como configuração porque isso evita hardcode e permite ajustar antes do início do bolão.
```
