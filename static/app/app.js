/**
 * MVP Bolão — cliente estático (Etapa 12: UX + responsividade §18).
 * Abra a partir do mesmo host da API: http://localhost:8000/static/app/index.html
 */
(function () {
  "use strict";

  const LS = "bolao_access_token";
  const LS_OPCOES_ESPECIAIS = "bolao_opcoes_especiais";
  const state = {
    token: null,
    user: null,
    paises: [],
    palpitesByJogo: new Map(),
    marcadoresCache: new Map(),
    /** Lista cronológica (GET /jogos/cronologico) para calcular bloqueio por rodada/fase. */
    jogosCrono: [],
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }
  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function escapeHtml(s) {
    if (s == null || s === "") return "";
    const d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  /** Opções sugeridas para melhor jogador / artilheiro / goleiro (admin edita; todos usam nas telas de especiais). */
  function getOpcoesEspeciais() {
    try {
      const raw = localStorage.getItem(LS_OPCOES_ESPECIAIS);
      if (!raw) return { melhor_jogador: [], artilheiro: [], melhor_goleiro: [] };
      const o = JSON.parse(raw);
      const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
      return {
        melhor_jogador: arr(o.melhor_jogador),
        artilheiro: arr(o.artilheiro),
        melhor_goleiro: arr(o.melhor_goleiro),
      };
    } catch {
      return { melhor_jogador: [], artilheiro: [], melhor_goleiro: [] };
    }
  }

  function setOpcoesEspeciais(o) {
    localStorage.setItem(
      LS_OPCOES_ESPECIAIS,
      JSON.stringify({
        melhor_jogador: o.melhor_jogador || [],
        artilheiro: o.artilheiro || [],
        melhor_goleiro: o.melhor_goleiro || [],
      })
    );
  }

  function datalistOptionsFromStrings(arr) {
    const seen = new Set();
    const out = [];
    for (const s of arr || []) {
      const t = String(s).trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(`<option value="${escapeHtml(t)}"></option>`);
    }
    return out.join("");
  }

  function toast(msg, isError) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    el.classList.toggle("error", !!isError);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 4200);
  }

  function apiUrl(path) {
    if (path.startsWith("http")) return path;
    const base = window.location.origin;
    return base + (path.startsWith("/") ? path : "/" + path);
  }

  function isCredentialLoginPath(path) {
    const p = String(path || "").split("?")[0];
    return p === "/auth/login" || p.endsWith("/auth/login");
  }

  async function api(path, opts = {}) {
    const hadTokenAtStart = !!state.token;
    const headers = Object.assign(
      { Accept: "application/json" },
      opts.headers || {},
      state.token ? { Authorization: "Bearer " + state.token } : {}
    );
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      opts = Object.assign({}, opts, { body: JSON.stringify(opts.body) });
    }
    const res = await fetch(apiUrl(path), Object.assign({}, opts, { headers }));
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      if (res.status === 401 && hadTokenAtStart) {
        if (isCredentialLoginPath(path)) {
          logout();
        } else {
          logout();
          toast("Sessão expirada. Entre novamente.", true);
        }
      }
      const detail =
        data && data.detail
          ? typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail)
          : res.statusText;
      const err = new Error(detail || "Erro na requisição");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function showView(name) {
    $all(".view").forEach((v) => (v.hidden = v.id !== "view-" + name));
    document.body.classList.toggle("app-has-bottom-nav", name === "main");
  }

  function imgUrl(url) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return apiUrl(url.startsWith("/") ? url : "/" + url);
  }

  function isBrasil(j) {
    const c = j.pais_casa && j.pais_casa.sigla;
    const f = j.pais_fora && j.pais_fora.sigla;
    return c === "BR" || f === "BR";
  }

  const FASE_MATA_SLUGS = new Set([
    "dezesseis_avos",
    "oitavas",
    "quartas",
    "semi",
    "terceiro_lugar",
    "final",
  ]);

  function normalizeFaseMataSlugDb(fase) {
    const t = String(fase || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    const aliases = { semifinal: "semi", semi_final: "semi", oitavas_de_final: "oitavas" };
    const x = aliases[t] || t;
    return FASE_MATA_SLUGS.has(x) ? x : null;
  }

  const FASE_MATA_LABELS = {
    dezesseis_avos: "Dezesseis avos de final",
    oitavas: "Oitavas de final",
    quartas: "Quartas de final",
    semi: "Semifinal",
    terceiro_lugar: "Disputa de 3º lugar",
    final: "Final",
  };

  function faseMataMataLabel(fase) {
    const s = normalizeFaseMataSlugDb(fase);
    return s ? FASE_MATA_LABELS[s] || String(fase || "") : String(fase || "");
  }

  function primeiroInicioGrupoPorRodada(todos, rodada) {
    const ts = (todos || [])
      .filter((g) => g.tipo_fase === "grupos" && Number(g.rodada) === Number(rodada))
      .map((g) => new Date(g.data_jogo).getTime())
      .filter(Number.isFinite);
    return ts.length ? Math.min(...ts) : null;
  }

  function primeiroInicioMataPorFase(todos, slug) {
    const ts = (todos || [])
      .filter((g) => g.tipo_fase === "mata_mata" && normalizeFaseMataSlugDb(g.fase) === slug)
      .map((g) => new Date(g.data_jogo).getTime())
      .filter(Number.isFinite);
    return ts.length ? Math.min(...ts) : null;
  }

  /** Alinha com o backend: 1h antes do 1º jogo da rodada (grupos) ou da fase (mata-mata), senão início do jogo. */
  function momentoFimEdicaoPalpiteCliente(j, todosJogos) {
    const MS_1H = 3600000;
    const todos = todosJogos && todosJogos.length ? todosJogos : [j];
    if (j.tipo_fase === "grupos" && j.rodada != null && j.rodada !== "") {
      const p = primeiroInicioGrupoPorRodada(todos, j.rodada);
      if (p != null) return p - MS_1H;
    }
    if (j.tipo_fase === "mata_mata") {
      const slug = normalizeFaseMataSlugDb(j.fase);
      if (slug) {
        const p = primeiroInicioMataPorFase(todos, slug);
        if (p != null) return p - MS_1H;
      }
    }
    return new Date(j.data_jogo).getTime();
  }

  function jogoBloqueado(j) {
    if (j.finalizado) return true;
    const todos = state.jogosCrono && state.jogosCrono.length ? state.jogosCrono : [j];
    const lim = momentoFimEdicaoPalpiteCliente(j, todos);
    return Number.isFinite(lim) && Date.now() >= lim;
  }

  function statusBadges(j) {
    const parts = [];
    if (j.finalizado) parts.push('<span class="badge badge-done">Finalizado</span>');
    else if (jogoBloqueado(j)) parts.push('<span class="badge badge-lock">Palpite fechado</span>');
    else parts.push('<span class="badge badge-live">Palpite aberto</span>');
    if (j.teve_prorrogacao) parts.push('<span class="badge">Prorrogação</span>');
    if (j.foi_para_penaltis && j.penaltis_casa != null && j.penaltis_fora != null) {
      parts.push(
        '<span class="badge">Pênaltis ' +
          escapeHtml(String(j.penaltis_casa)) +
          "×" +
          escapeHtml(String(j.penaltis_fora)) +
          "</span>"
      );
    }
    return parts.join(" ");
  }

  async function postLogin(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      const body = { email: fd.get("email"), senha: fd.get("senha") };
      const r = await api("/auth/login", { method: "POST", body });
      state.token = r.access_token;
      localStorage.setItem(LS, state.token);
      try {
        sessionStorage.setItem("bolao_email", String(body.email || ""));
      } catch {
        /* ignore */
      }
      if (r.primeiro_login) {
        showView("primeiro");
      } else {
        await bootstrapMain();
      }
    } catch (e) {
      toast(e.message || "Falha no login", true);
    }
  }

  async function postPrimeiro(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = {
      nome: fd.get("nome"),
      funcao: fd.get("funcao"),
      imagem_perfil: fd.get("imagem_perfil") || null,
      nova_senha: fd.get("nova_senha"),
      confirmar_senha: fd.get("confirmar_senha"),
    };
    try {
      await api("/auth/primeiro-acesso", { method: "POST", body });
      toast("Perfil atualizado. Entre novamente.");
      state.token = null;
      localStorage.removeItem(LS);
      showView("login");
      const em = sessionStorage.getItem("bolao_email");
      const emInput = $("#form-login")?.querySelector('[name="email"]');
      if (em && emInput) emInput.value = em;
    } catch (e) {
      toast(e.message || "Erro", true);
    }
  }

  async function bootstrapMain() {
    try {
      state.user = await api("/auth/me");
      if (state.user.primeiro_login) {
        showView("primeiro");
        return;
      }
      state.paises = await api("/paises");
    } catch (e) {
      if (e.status === 401) return;
      toast(e.message || "Sessão inválida", true);
      logout();
      return;
    }
    $("#main-user-label").textContent = state.user.nome || "Bolão";
    applyAdminVisibility();
    showView("main");
    try {
      await refreshPalpites();
    } catch (e) {
      if (e.status === 403) {
        toast("Conclua o primeiro acesso para ver palpites.", true);
        showView("primeiro");
        return;
      }
      if (e.status === 401) return;
      toast(e.message || "Não foi possível carregar palpites.", true);
      state.palpitesByJogo = new Map();
    }
    if (!state.token) return;
    await renderPalpitesCrono();
    await renderPalpitesGrupos();
    await loadEspeciaisPanel();
    await loadGruposPanel();
    await loadRankingPanel();
  }

  async function refreshPalpites() {
    const list = await api("/palpites-jogos/me");
    state.palpitesByJogo = new Map((list || []).map((p) => [p.jogo_id, p]));
  }

  function palpiteFor(jogoId) {
    return state.palpitesByJogo.get(jogoId) || null;
  }

  function renderGameCard(j) {
    const p = palpiteFor(j.id);
    const bloq = jogoBloqueado(j);
    const pc = p && p.palpite_casa != null ? p.palpite_casa : "";
    const pf = p && p.palpite_fora != null ? p.palpite_fora : "";
    const resC = j.placar_casa != null ? j.placar_casa : "—";
    const resF = j.placar_fora != null ? j.placar_fora : "—";
    let classHtml = "";
    if (j.tipo_fase === "mata_mata") {
      const cur = p && p.palpite_classificado_id ? String(p.palpite_classificado_id) : "";
      const opts = [
        `<option value="">Quem passa?</option>`,
        `<option value="${j.pais_casa_id}" ${cur == String(j.pais_casa_id) ? "selected" : ""}>${escapeHtml(j.pais_casa.nome)}</option>`,
        `<option value="${j.pais_fora_id}" ${cur == String(j.pais_fora_id) ? "selected" : ""}>${escapeHtml(j.pais_fora.nome)}</option>`,
      ].join("");
      classHtml = `<div class="classificado-block"><label>Classificado (mata-mata)<select name="classificado" ${bloq ? "disabled" : ""}>${opts}</select></label></div>`;
    }
    const br = isBrasil(j);
    const mid = "m-" + j.id;
    const marcDetails =
      br && p
        ? `<details class="marcadores-details" id="${mid}"><summary>Marcadores do Brasil (bônus)</summary><div class="marcadores-body" data-jogo="${j.id}"></div></details>`
        : br && !p
          ? '<p class="meta-line">Salve o palpite do jogo antes dos marcadores.</p>'
          : "";
    const rodadaTxt =
      j.tipo_fase === "grupos" && j.rodada != null && j.rodada !== ""
        ? " · Rodada " + escapeHtml(String(j.rodada))
        : "";
    const faseTxt =
      j.tipo_fase === "mata_mata" ? escapeHtml(faseMataMataLabel(j.fase)) : escapeHtml(j.fase);

    return (
      `<article class="game-card" data-jogo-id="${j.id}" data-tipo-fase="${escapeHtml(j.tipo_fase)}">` +
      `<div class="game-card-header"><div>${statusBadges(j)}</div>` +
      `<div class="meta-line">${faseTxt}${rodadaTxt} · ${new Date(j.data_jogo).toLocaleString("pt-BR")}</div></div>` +
      `<div class="match-row">` +
      `<div class="team"><img src="${escapeHtml(imgUrl(j.pais_casa.bandeira_url))}" alt="" width="36" height="24" loading="lazy"/><span>${escapeHtml(j.pais_casa.nome)}</span></div>` +
      `<div class="score-row">` +
      `<input class="score-input" type="number" min="0" name="casa" value="${escapeHtml(String(pc))}" aria-label="Palpite casa" ${bloq ? "disabled" : ""}/>` +
      `<span>×</span>` +
      `<input class="score-input" type="number" min="0" name="fora" value="${escapeHtml(String(pf))}" aria-label="Palpite fora" ${bloq ? "disabled" : ""}/>` +
      `</div>` +
      `<div class="team"><img src="${escapeHtml(imgUrl(j.pais_fora.bandeira_url))}" alt="" width="36" height="24" loading="lazy"/><span>${escapeHtml(j.pais_fora.nome)}</span></div>` +
      `</div>` +
      classHtml +
      `<div class="meta-line">Resultado: ${escapeHtml(String(resC))} × ${escapeHtml(String(resF))}</div>` +
      marcDetails +
      `<div class="btn-row">` +
      `<button type="button" class="btn btn-primary btn-save-palpite" ${bloq ? "disabled" : ""}>Salvar palpite</button>` +
      `</div></article>`
    );
  }

  async function fillMarcadores(detailsEl, jogoId) {
    const body = detailsEl.querySelector(".marcadores-body");
    if (!body || body.dataset.loaded) return;
    const p = palpiteFor(jogoId);
    const j = p && p.jogo ? p.jogo : null;
    const bloq = j ? jogoBloqueado(j) : true;
    let rows = [];
    try {
      rows = await api("/marcadores-brasil/me/" + jogoId);
    } catch {
      rows = [];
    }
    let candidatos = [];
    try {
      candidatos = await api("/marcadores-brasil/candidatos");
    } catch {
      candidatos = [];
    }
    const dlId = "dl-mb-jogo-" + jogoId;
    const dlOpts = datalistOptionsFromStrings((candidatos || []).map((c) => c.nome));
    body.dataset.loaded = "1";
    const dis = bloq ? "disabled" : "";
    const listAttr = ` list="${dlId}" autocomplete="off"`;
    const lines = rows.length
      ? rows
          .map(
            (r) =>
              `<div class="marcador-linha">` +
              `<input type="text" name="nome" placeholder="Jogador (lista ou digite)" value="${escapeHtml(r.nome_jogador)}" ${listAttr} ${dis}/>` +
              `<input type="number" min="0" name="qtd" value="${escapeHtml(String(r.quantidade_gols))}" aria-label="Gols" ${dis}/>` +
              `</div>`
          )
          .join("")
      : `<div class="marcador-linha"><input type="text" name="nome" placeholder="Jogador (lista ou digite)" ${listAttr} ${dis}/><input type="number" min="0" name="qtd" value="1" aria-label="Gols" ${dis}/></div>`;

    body.innerHTML =
      `<datalist id="${dlId}">${dlOpts}</datalist>` +
      lines +
      `<div class="btn-row">` +
      `<button type="button" class="btn btn-secondary btn-add-marcador" ${dis}>Adicionar marcador</button>` +
      `<button type="button" class="btn btn-primary btn-save-marcadores" ${dis}>Salvar marcadores</button>` +
      `</div>`;

    body.querySelector(".btn-add-marcador")?.addEventListener("click", () => {
      if (bloq) return;
      const wrap = document.createElement("div");
      wrap.className = "marcador-linha";
      wrap.innerHTML =
        `<input type="text" name="nome" placeholder="Jogador (lista ou digite)" list="${dlId}" autocomplete="off"/><input type="number" min="0" name="qtd" value="1" aria-label="Gols"/>`;
      body.insertBefore(wrap, body.querySelector(".btn-row"));
    });

    body.querySelector(".btn-save-marcadores")?.addEventListener("click", () => saveMarcadores(jogoId, body));
  }

  async function saveMarcadores(jogoId, body) {
    const linhas = $all(".marcador-linha", body);
    const marcadores = [];
    for (const ln of linhas) {
      const nome = (ln.querySelector('[name="nome"]') || {}).value;
      const q = parseInt((ln.querySelector('[name="qtd"]') || {}).value, 10);
      if (nome && nome.trim()) marcadores.push({ nome_jogador: nome.trim(), quantidade_gols: Number.isFinite(q) && q >= 0 ? q : 0 });
    }
    try {
      await api("/marcadores-brasil/" + jogoId, { method: "PUT", body: { marcadores } });
      toast("Marcadores salvos");
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function savePalpiteFromCard(card) {
    const jogoId = parseInt(card.dataset.jogoId, 10);
    const casa = parseInt((card.querySelector('[name="casa"]') || {}).value, 10);
    const fora = parseInt((card.querySelector('[name="fora"]') || {}).value, 10);
    const sel = card.querySelector('[name="classificado"]');
    const classificado = sel && sel.value ? parseInt(sel.value, 10) : null;
    const p = palpiteFor(jogoId);
    if (!Number.isFinite(casa) || !Number.isFinite(fora) || casa < 0 || fora < 0) {
      toast("Informe placares válidos (números ≥ 0).", true);
      return;
    }
    const jogoTipo = card.dataset.tipoFase;
    if (jogoTipo === "mata_mata" && !classificado) {
      toast("Em mata-mata, escolha quem se classifica.", true);
      return;
    }
    try {
      if (!p) {
        await api("/palpites-jogos", {
          method: "POST",
          body: { jogo_id: jogoId, palpite_casa: casa, palpite_fora: fora, palpite_classificado_id: classificado },
        });
      } else {
        await api("/palpites-jogos/" + p.id, {
          method: "PUT",
          body: { palpite_casa: casa, palpite_fora: fora, palpite_classificado_id: classificado },
        });
      }
      await refreshPalpites();
      toast("Palpite salvo");
      await renderPalpitesCrono();
      await renderPalpitesGrupos();
    } catch (e) {
      toast(e.message, true);
    }
  }

  function wireGameCards(root) {
    root.querySelectorAll(".btn-save-palpite").forEach((btn) => {
      btn.addEventListener("click", () => savePalpiteFromCard(btn.closest(".game-card")));
    });
    root.querySelectorAll("details.marcadores-details").forEach((det) => {
      det.addEventListener("toggle", () => {
        if (det.open) {
          const id = parseInt(det.closest(".game-card").dataset.jogoId, 10);
          if (!palpiteFor(id)) {
            toast("Salve o palpite do jogo antes dos marcadores.", true);
            det.open = false;
            return;
          }
          fillMarcadores(det, id);
        }
      });
    });
  }

  async function renderPalpitesCrono() {
    const el = $("#palpites-crono");
    el.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      const jogos = await api("/jogos/cronologico");
      state.jogosCrono = Array.isArray(jogos) ? jogos : [];
      el.innerHTML = jogos.map(renderGameCard).join("") || "<p>Nenhum jogo cadastrado.</p>";
      wireGameCards(el);
    } catch (e) {
      state.jogosCrono = [];
      el.innerHTML = "<p>Erro ao carregar jogos.</p>";
      toast(e.message, true);
    }
  }

  async function renderPalpitesGrupos() {
    const el = $("#palpites-grupos");
    el.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      if (!state.jogosCrono || !state.jogosCrono.length) {
        try {
          state.jogosCrono = await api("/jogos/cronologico");
        } catch {
          state.jogosCrono = [];
        }
      }
      const data = await api("/jogos/grupos");
      let html = "";
      for (const bl of data.grupos || []) {
        html += `<h3 class="grupo-bloco-title">Grupo ${escapeHtml(bl.grupo)}</h3>`;
        html += (bl.jogos || []).map(renderGameCard).join("");
      }
      el.innerHTML = html || "<p>Nenhum jogo de grupos.</p>";
      wireGameCards(el);
    } catch (e) {
      el.innerHTML = "<p>Erro ao carregar jogos por grupo.</p>";
      toast(e.message, true);
    }
  }

  async function loadEspeciaisPanel() {
    const el = $("#especiais-content");
    el.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      let pe = null;
      try {
        pe = await api("/palpites-especiais/me");
      } catch {
        pe = null;
      }
      const bloq = pe && pe.bloqueado;
      const campeaoOpts = (state.paises || [])
        .map(
          (p) =>
            `<option value="${p.id}" ${pe && pe.campeao_id === p.id ? "selected" : ""}>` +
            `${escapeHtml(p.nome)} (${escapeHtml(p.sigla)})</option>`
        )
        .join("");
      const pts = pe
        ? `<div class="pontos-especiais-mini">` +
          `<span>Campeão: ${pe.pontuacao_campeao}</span>` +
          `<span>Melhor jogador: ${pe.pontuacao_melhor_jogador}</span>` +
          `<span>Artilheiro: ${pe.pontuacao_artilheiro}</span>` +
          `<span>Goleiro: ${pe.pontuacao_melhor_goleiro}</span>` +
          `<span><strong>Total: ${pe.pontuacao_total}</strong></span></div>`
        : "";
      const op = getOpcoesEspeciais();
      const dlMj = datalistOptionsFromStrings(op.melhor_jogador);
      const dlArt = datalistOptionsFromStrings(op.artilheiro);
      const dlGol = datalistOptionsFromStrings(op.melhor_goleiro);
      el.innerHTML =
        (bloq ? '<div class="blocked-banner">Palpites especiais bloqueados.</div>' : "") +
        `<datalist id="dl-pe-mj">${dlMj}</datalist>` +
        `<datalist id="dl-pe-art">${dlArt}</datalist>` +
        `<datalist id="dl-pe-gol">${dlGol}</datalist>` +
        `<form id="form-especiais" class="form-card" style="background:transparent;border:none;padding:0">` +
        `<label>Campeão<select name="campeao_id" ${bloq ? "disabled" : ""}><option value="">—</option>${campeaoOpts}</select></label>` +
        `<label>Melhor jogador<input type="text" name="melhor_jogador" list="dl-pe-mj" autocomplete="off" value="${pe && pe.melhor_jogador ? escapeHtml(pe.melhor_jogador) : ""}" ${bloq ? "disabled" : ""} placeholder="Escolha na lista ou digite"/></label>` +
        `<label>Artilheiro<input type="text" name="artilheiro" list="dl-pe-art" autocomplete="off" value="${pe && pe.artilheiro ? escapeHtml(pe.artilheiro) : ""}" ${bloq ? "disabled" : ""} placeholder="Escolha na lista ou digite"/></label>` +
        `<label>Melhor goleiro<input type="text" name="melhor_goleiro" list="dl-pe-gol" autocomplete="off" value="${pe && pe.melhor_goleiro ? escapeHtml(pe.melhor_goleiro) : ""}" ${bloq ? "disabled" : ""} placeholder="Escolha na lista ou digite"/></label>` +
        pts +
        `<button type="submit" class="btn btn-primary" style="margin-top:0.75rem" ${bloq ? "disabled" : ""}>Salvar</button>` +
        `</form>`;
      $("#form-especiais")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        if (bloq) return;
        const f = ev.target;
        const body = {
          campeao_id: f.campeao_id.value ? parseInt(f.campeao_id.value, 10) : null,
          melhor_jogador: f.melhor_jogador.value || null,
          artilheiro: f.artilheiro.value || null,
          melhor_goleiro: f.melhor_goleiro.value || null,
        };
        try {
          if (pe) await api("/palpites-especiais/me", { method: "PUT", body });
          else await api("/palpites-especiais", { method: "POST", body });
          toast("Palpites especiais salvos");
          await loadEspeciaisPanel();
        } catch (err) {
          toast(err.message, true);
        }
      });
    } catch (e) {
      el.textContent = "Erro ao carregar palpites especiais.";
      toast(e.message, true);
    }
  }

  async function loadGruposPanel() {
    const sel = $("#select-grupo-letra");
    try {
      const grupos = await api("/grupos");
      sel.innerHTML = (grupos.grupos || []).map((g) => `<option value="${escapeHtml(g)}">Grupo ${escapeHtml(g)}</option>`).join("");
      if (!sel.innerHTML) sel.innerHTML = '<option value="">—</option>';
    } catch {
      sel.innerHTML = '<option value="">—</option>';
    }
    $("#btn-atualizar-tabela").onclick = renderGrupoTabela;
    if (sel.value) renderGrupoTabela();
  }

  async function renderGrupoTabela() {
    const letra = ($("#select-grupo-letra") || {}).value;
    const wrap = $("#grupo-tabela-wrap");
    if (!letra) {
      wrap.innerHTML = "<p class=\"meta-line\">Nenhum grupo disponível.</p>";
      return;
    }
    wrap.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      const t = await api("/grupos/" + encodeURIComponent(letra) + "/tabela");
      const rows = (t.linhas || [])
        .map(
          (ln) =>
            `<tr>` +
            `<td>${ln.posicao}</td>` +
            `<td><img src="${escapeHtml(imgUrl(ln.bandeira_url))}" alt="" width="28" height="18" loading="lazy"/></td>` +
            `<td>${escapeHtml(ln.nome)}</td>` +
            `<td><strong>${ln.pontos}</strong></td>` +
            `<td class="compact-hide">${ln.jogos}</td>` +
            `<td class="compact-hide">${ln.vitorias}</td>` +
            `<td class="compact-hide">${ln.empates}</td>` +
            `<td class="compact-hide">${ln.derrotas}</td>` +
            `<td class="compact-hide">${ln.gols_pro}</td>` +
            `<td class="compact-hide">${ln.gols_contra}</td>` +
            `<td class="compact-hide">${ln.saldo_gols}</td>` +
            `</tr>`
        )
        .join("");
      wrap.innerHTML =
        `<table class="tabela-grupo"><thead><tr>` +
        `<th>Pos</th><th></th><th>País</th><th>Pts</th>` +
        `<th class="compact-hide">J</th><th class="compact-hide">V</th><th class="compact-hide">E</th><th class="compact-hide">D</th>` +
        `<th class="compact-hide">GP</th><th class="compact-hide">GC</th><th class="compact-hide">SG</th>` +
        `</tr></thead><tbody>${rows}</tbody></table>`;
    } catch (e) {
      wrap.innerHTML = "<p>Não foi possível carregar a tabela.</p>";
      toast(e.message, true);
    }
  }

  async function loadRankingPanel() {
    const el = $("#ranking-content");
    el.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      const r = await api("/ranking");
      const linhas = r.linhas || [];
      const cards = linhas
        .map((ln) => {
          const av = ln.imagem_perfil
            ? `<img class="avatar" src="${escapeHtml(imgUrl(ln.imagem_perfil))}" alt="" loading="lazy"/>`
            : '<span class="avatar avatar-ph" aria-hidden="true"></span>';
          return (
            `<div class="ranking-card">` +
            `<span class="pos">${ln.posicao}</span>` +
            av +
            `<div class="nome">${escapeHtml(ln.nome)}</div>` +
            `<div class="pts">${ln.pontos_totais}</div>` +
            `<div class="extra">Jogos: ${ln.pontos_jogos} · Brasil: ${ln.bonus_brasil} · Especiais: ${ln.pontos_especiais}</div>` +
            `</div>`
          );
        })
        .join("");
      const wideRows = linhas
        .map(
          (ln) =>
            `<tr>` +
            `<td>${ln.posicao}</td>` +
            `<td>${escapeHtml(ln.nome)}</td>` +
            `<td class="num">${ln.pontos_jogos}</td>` +
            `<td class="num">${ln.bonus_brasil}</td>` +
            `<td class="num">${ln.pontos_especiais}</td>` +
            `<td class="num"><strong>${ln.pontos_totais}</strong></td>` +
            `</tr>`
        )
        .join("");
      el.innerHTML =
        `<div class="ranking-cards">${cards}</div>` +
        `<div class="ranking-table-wrap card table-scroll">` +
        `<table class="ranking-wide"><thead><tr><th>#</th><th>Nome</th><th class="num">Jogos</th><th class="num">BR</th><th class="num">Esp.</th><th class="num">Total</th></tr></thead><tbody>${wideRows}</tbody></table>` +
        `</div>`;
    } catch (e) {
      el.textContent = "Erro ao carregar ranking.";
      toast(e.message, true);
    }
  }

  function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem(LS);
    applyAdminVisibility();
    showView("login");
  }

  function isAdmin() {
    return !!(state.user && state.user.tipo_usuario === "admin");
  }

  function applyAdminVisibility() {
    const btn = $("#nav-item-admin");
    if (btn) btn.hidden = !isAdmin();
  }

  function isoToDatetimeLocal(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function datetimeLocalToIso(val) {
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function countryOptionsHtml(selectedId) {
    return (state.paises || [])
      .map(
        (p) =>
          `<option value="${p.id}" ${Number(selectedId) === p.id ? "selected" : ""}>${escapeHtml(p.nome)} (${escapeHtml(p.sigla)})</option>`
      )
      .join("");
  }

  /** Letra do grupo (ex.: "a" → "A"; "Grupo B" → "B"). */
  function adminGrupoLetra(raw) {
    const t = String(raw || "").trim().toUpperCase();
    if (!t) return "";
    const m = t.match(/^GRUPO\s+([A-Z0-9]+)$/);
    if (m) return m[1];
    if (t.length === 1) return t;
    return t.replace(/^[^A-Z0-9]+/, "").slice(0, 1) || t.slice(0, 1);
  }

  function adminJogoPaisesLista(form) {
    const all = state.paises || [];
    if (!form || !form.elements) return all;
    const tipo = form.elements.tipo_fase.value;
    const letra = adminGrupoLetra(form.elements.grupo.value);
    if (tipo !== "grupos" || !letra) return all;
    return all.filter((p) => (p.grupo || "").trim().toUpperCase() === letra);
  }

  function adminJogoFillPaisSelects(form, preserveSelection) {
    if (!form || !form.elements) return;
    const lista = adminJogoPaisesLista(form);
    const curC = preserveSelection ? String(form.elements.pais_casa_id.value || "") : "";
    const curF = preserveSelection ? String(form.elements.pais_fora_id.value || "") : "";
    const ids = new Set(lista.map((p) => String(p.id)));
    const selC = curC && ids.has(curC) ? curC : "";
    const selF = curF && ids.has(curF) ? curF : "";
    const mk = (selected) =>
      `<option value="">—</option>` +
      lista
        .map(
          (p) =>
            `<option value="${p.id}" ${String(selected) === String(p.id) ? "selected" : ""}>${escapeHtml(p.nome)} (${escapeHtml(p.sigla)})</option>`
        )
        .join("");
    form.elements.pais_casa_id.innerHTML = mk(selC);
    form.elements.pais_fora_id.innerHTML = mk(selF);
  }

  /** Opções de grupo na Copa (A–L) para o formulário de jogo. */
  function adminGrupoLetrasSelectHtml(selectedRaw) {
    const sel = String(selectedRaw || "").trim().toUpperCase();
    const parts = ['<option value="">—</option>'];
    for (let i = 0; i < 12; i++) {
      const L = String.fromCharCode(65 + i);
      parts.push(`<option value="${L}" ${sel === L ? "selected" : ""}>Grupo ${L}</option>`);
    }
    return parts.join("");
  }

  /** Fases de mata-mata (slug = valor enviado à API). */
  function adminFaseMataSelectHtml(selectedRaw) {
    const opts = [
      { value: "dezesseis_avos", label: "Dezesseis avos de final" },
      { value: "oitavas", label: "Oitavas de final" },
      { value: "quartas", label: "Quartas de final" },
      { value: "semi", label: "Semifinal" },
      { value: "terceiro_lugar", label: "Disputa de 3º lugar" },
      { value: "final", label: "Final" },
    ];
    const slug = normalizeFaseMataSlugDb(selectedRaw);
    const parts = ['<option value="">—</option>'];
    for (const o of opts) {
      parts.push(
        `<option value="${o.value}" ${slug === o.value ? "selected" : ""}>${escapeHtml(o.label)}</option>`
      );
    }
    const rawT = String(selectedRaw || "").trim();
    if (rawT && !slug) {
      parts.push(
        `<option value="${escapeHtml(rawT)}" selected>${escapeHtml(rawT)} (legado — salve com fase válida)</option>`
      );
    }
    return parts.join("");
  }

  /** Alterna blocos grupos vs mata-mata e filtra países pelo grupo (A–L). */
  function adminJogoSyncGrupoFaseEPaises() {
    const fj = $("#form-admin-jogo");
    if (!fj || !fj.elements) return;
    const tipo = fj.elements.tipo_fase.value;
    const blockG = $("#admin-jogo-block-grupos");
    const blockM = $("#admin-jogo-block-mata");
    const grupoEl = fj.elements.grupo;
    const faseMata = fj.elements.fase_mata;
    const rodadaEl = fj.elements.rodada;
    if (grupoEl && grupoEl.tagName === "SELECT") {
      grupoEl.disabled = tipo !== "grupos";
      if (tipo !== "grupos") grupoEl.value = "";
    }
    if (blockG && blockM) {
      if (tipo === "grupos") {
        blockG.hidden = false;
        blockM.hidden = true;
      } else {
        blockG.hidden = true;
        blockM.hidden = false;
      }
    }
    if (faseMata) faseMata.required = tipo === "mata_mata";
    if (rodadaEl) {
      rodadaEl.disabled = tipo !== "grupos";
      rodadaEl.required = tipo === "grupos";
      if (tipo !== "grupos") rodadaEl.value = "";
    }
    adminJogoFillPaisSelects(fj, true);
  }

  function refreshActiveAdminPanel() {
    if (!isAdmin()) return;
    const sub = $(".admin-sub-pill.active")?.dataset.adminSub || "jogos";
    const actions = {
      jogos: loadAdminJogos,
      paises: loadAdminPaises,
      usuarios: loadAdminUsuarios,
      marcadores: loadAdminMarcadores,
      "especiais-adm": loadAdminEspeciaisAdm,
      config: loadAdminConfig,
    };
    const fn = actions[sub];
    if (fn) fn();
  }

  async function loadAdminJogos() {
    const wrap = $("#admin-jogos");
    if (!wrap) return;
    wrap.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      let jogos = [];
      try {
        jogos = await api("/jogos");
      } catch (e) {
        toast(e.message || "Erro ao listar jogos", true);
        jogos = [];
      }
      const rows = jogos
        .map((j) => {
          const dt = new Date(j.data_jogo).toLocaleString("pt-BR");
          const faseAdm =
            j.tipo_fase === "mata_mata" ? escapeHtml(faseMataMataLabel(j.fase)) : escapeHtml(j.fase);
          const rodCell = j.rodada != null && j.rodada !== "" ? escapeHtml(String(j.rodada)) : "—";
          return (
            `<tr>` +
            `<td>${j.id}</td>` +
            `<td>${faseAdm}</td>` +
            `<td>${escapeHtml(j.tipo_fase)} ${j.grupo ? "· " + escapeHtml(j.grupo) : ""}</td>` +
            `<td>${rodCell}</td>` +
            `<td>${escapeHtml(j.pais_casa.sigla)} × ${escapeHtml(j.pais_fora.sigla)}</td>` +
            `<td>${escapeHtml(dt)}</td>` +
            `<td>${j.finalizado ? "Sim" : "Não"}</td>` +
            `<td class="admin-actions">` +
            `<button type="button" class="btn btn-secondary btn-admin-j-edit" data-jid="${j.id}">Editar</button>` +
            `<button type="button" class="btn btn-secondary btn-admin-j-res" data-jid="${j.id}">Placar</button>` +
            `<button type="button" class="btn btn-secondary btn-admin-j-fin" data-jid="${j.id}" ${j.finalizado ? "disabled" : ""}>Finalizar</button>` +
            `</td></tr>`
          );
        })
        .join("");
      wrap.innerHTML =
        `<div class="card">` +
        `<div class="admin-toolbar"><button type="button" class="btn btn-primary" id="btn-admin-jogo-clear">Novo jogo</button></div>` +
        `<form id="form-admin-jogo" class="form-card form-grid-2" style="margin-bottom:1rem">` +
        `<input type="hidden" name="editing_id" value="" />` +
        `<label style="grid-column:1/-1">Tipo de jogo<select name="tipo_fase">` +
        `<option value="grupos">Fase de grupos</option>` +
        `<option value="mata_mata">Mata-mata (eliminatórias)</option></select></label>` +
        `<div id="admin-jogo-block-grupos" class="admin-jogo-type-block" style="grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:0 1rem">` +
        `<label>Rodada na 1ª fase<input type="number" name="rodada" min="1" step="1" placeholder="1, 2, 3…" title="Mesmo número em todos os jogos da mesma rodada (ex.: todos os jogos da 1ª rodada = 1). Fecha palpites 1h antes do 1º jogo dessa rodada." /></label>` +
        `<label>Chave (grupo A a L)<select name="grupo">${adminGrupoLetrasSelectHtml("")}</select></label>` +
        `<p class="meta-line" style="grid-column:1/-1;margin:0">O nome da fase no bolão será <strong>Grupo</strong> + a letra (ex.: Grupo A). Só aparecem países cadastrados nessa chave.</p>` +
        `</div>` +
        `<div id="admin-jogo-block-mata" class="admin-jogo-type-block" style="grid-column:1/-1" hidden>` +
        `<label>Fase eliminatória<select name="fase_mata">${adminFaseMataSelectHtml("")}</select></label>` +
        `<p class="meta-line" style="margin:0">Oitavas, quartas, final etc. Palpites fecham 1h antes do <strong>primeiro</strong> jogo desta fase.</p>` +
        `</div>` +
        `<label>Casa<select name="pais_casa_id"><option value="">—</option>${countryOptionsHtml()}</select></label>` +
        `<label>Fora<select name="pais_fora_id"><option value="">—</option>${countryOptionsHtml()}</select></label>` +
        `<label>Data e hora<input type="datetime-local" name="data_jogo" required /></label>` +
        `<div style="grid-column:1/-1;display:flex;gap:0.5rem;flex-wrap:wrap">` +
        `<button type="submit" class="btn btn-primary">Salvar jogo</button>` +
        `</div></form></div>` +
        `<div class="table-scroll card"><table class="admin-table"><thead><tr>` +
        `<th>ID</th><th>Fase</th><th>Tipo</th><th>Rod.</th><th>Jogo</th><th>Data</th><th>Fin.</th><th>Ações</th>` +
        `</tr></thead><tbody>${rows || '<tr><td colspan="8">Nenhum jogo.</td></tr>'}</tbody></table></div>` +
        `<div id="admin-jogo-result-wrap" class="card admin-form-section" hidden>` +
        `<h3>Registrar placar (admin)</h3>` +
        `<form id="form-admin-resultado" class="form-grid-2">` +
        `<input type="hidden" name="result_jogo_id" value="" />` +
        `<label>Placar casa<input type="number" name="placar_casa" min="0" /></label>` +
        `<label>Placar fora<input type="number" name="placar_fora" min="0" /></label>` +
        `<label><input type="checkbox" name="teve_prorrogacao" /> Teve prorrogação</label>` +
        `<label><input type="checkbox" name="foi_para_penaltis" /> Foi para pênaltis</label>` +
        `<label>Pênaltis casa<input type="number" name="penaltis_casa" min="0" /></label>` +
        `<label>Pênaltis fora<input type="number" name="penaltis_fora" min="0" /></label>` +
        `<label>Classificado<select name="classificado_id"><option value="">—</option>${countryOptionsHtml()}</select></label>` +
        `<div style="grid-column:1/-1"><button type="submit" class="btn btn-primary">Salvar resultado</button> ` +
        `<button type="button" class="btn btn-secondary" id="btn-admin-result-cancel">Cancelar</button></div>` +
        `</form></div>`;

      const fj = $("#form-admin-jogo");
      fj?.elements.tipo_fase?.addEventListener("change", () => adminJogoSyncGrupoFaseEPaises());
      fj?.elements.grupo?.addEventListener("change", () => adminJogoSyncGrupoFaseEPaises());
      adminJogoSyncGrupoFaseEPaises();

      fj?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fd = new FormData(fj);
        const editing = fd.get("editing_id");
        const tipo = fd.get("tipo_fase");
        let fase;
        if (tipo === "grupos") {
          const letra = adminGrupoLetra(fd.get("grupo"));
          if (!letra) {
            toast("Escolha a chave do grupo (A a L).", true);
            return;
          }
          fase = "Grupo " + letra;
        } else {
          fase = fd.get("fase_mata");
          if (!fase || !String(fase).trim()) {
            toast("Escolha a fase eliminatória.", true);
            return;
          }
        }
        let rodada = null;
        if (tipo === "grupos") {
          const rn = parseInt(fd.get("rodada"), 10);
          if (!Number.isFinite(rn) || rn < 1) {
            toast("Informe a rodada (inteiro ≥ 1) para jogos de fase de grupos.", true);
            return;
          }
          rodada = rn;
        }
        const base = {
          fase,
          grupo: (fd.get("grupo") || "").trim() || null,
          tipo_fase: tipo,
          rodada,
          pais_casa_id: parseInt(fd.get("pais_casa_id"), 10),
          pais_fora_id: parseInt(fd.get("pais_fora_id"), 10),
          data_jogo: datetimeLocalToIso(fd.get("data_jogo")),
        };
        try {
          if (editing) {
            await api("/jogos/" + editing, {
              method: "PUT",
              body: {
                fase: base.fase,
                grupo: base.grupo,
                tipo_fase: base.tipo_fase,
                rodada: base.rodada,
                pais_casa_id: base.pais_casa_id,
                pais_fora_id: base.pais_fora_id,
                data_jogo: base.data_jogo,
              },
            });
            toast("Jogo atualizado");
          } else {
            await api("/jogos", { method: "POST", body: base });
            toast("Jogo criado");
          }
          await reloadPaisesState();
          loadAdminJogos();
          await refreshPalpites();
          await renderPalpitesCrono();
          await renderPalpitesGrupos();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });

      $("#btn-admin-jogo-clear")?.addEventListener("click", () => {
        fj.reset();
        const hid = fj.querySelector('[name="editing_id"]');
        if (hid) hid.value = "";
        if (fj.elements.grupo && fj.elements.grupo.tagName === "SELECT") {
          fj.elements.grupo.innerHTML = adminGrupoLetrasSelectHtml("");
        }
        if (fj.elements.fase_mata) fj.elements.fase_mata.innerHTML = adminFaseMataSelectHtml("");
        adminJogoSyncGrupoFaseEPaises();
      });

      wrap.querySelectorAll(".btn-admin-j-edit").forEach((b) => {
        b.addEventListener("click", () => {
          const id = parseInt(b.dataset.jid, 10);
          const j = jogos.find((x) => x.id === id);
          if (!j || !fj) return;
          const hid = fj.querySelector('[name="editing_id"]');
          if (hid) hid.value = String(j.id);
          fj.elements.tipo_fase.value = j.tipo_fase;
          const gRaw = j.grupo || "";
          fj.elements.grupo.innerHTML = adminGrupoLetrasSelectHtml(gRaw);
          const gU = String(gRaw).trim().toUpperCase();
          if (gRaw && !/^[A-L]$/.test(gU)) {
            const o = document.createElement("option");
            o.value = String(gRaw).trim();
            o.textContent = String(gRaw).trim();
            o.selected = true;
            fj.elements.grupo.appendChild(o);
          }
          fj.elements.rodada.value = j.rodada != null && j.rodada !== "" ? String(j.rodada) : "";
          fj.elements.data_jogo.value = isoToDatetimeLocal(j.data_jogo);
          if (j.tipo_fase === "mata_mata") {
            fj.elements.fase_mata.innerHTML = adminFaseMataSelectHtml(j.fase);
          } else {
            fj.elements.fase_mata.innerHTML = adminFaseMataSelectHtml("");
          }
          adminJogoSyncGrupoFaseEPaises();
          fj.elements.pais_casa_id.value = String(j.pais_casa_id);
          fj.elements.pais_fora_id.value = String(j.pais_fora_id);
          fj.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });

      const resWrap = $("#admin-jogo-result-wrap");
      const fr = $("#form-admin-resultado");
      wrap.querySelectorAll(".btn-admin-j-res").forEach((b) => {
        b.addEventListener("click", () => {
          const id = parseInt(b.dataset.jid, 10);
          const j = jogos.find((x) => x.id === id);
          if (!j || !fr || !resWrap) return;
          fr.elements.result_jogo_id.value = String(id);
          fr.elements.placar_casa.value = j.placar_casa != null ? j.placar_casa : "";
          fr.elements.placar_fora.value = j.placar_fora != null ? j.placar_fora : "";
          fr.elements.teve_prorrogacao.checked = !!j.teve_prorrogacao;
          fr.elements.foi_para_penaltis.checked = !!j.foi_para_penaltis;
          fr.elements.penaltis_casa.value = j.penaltis_casa != null ? j.penaltis_casa : "";
          fr.elements.penaltis_fora.value = j.penaltis_fora != null ? j.penaltis_fora : "";
          fr.elements.classificado_id.value = j.classificado_id != null ? String(j.classificado_id) : "";
          resWrap.hidden = false;
          resWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });

      $("#btn-admin-result-cancel")?.addEventListener("click", () => {
        if (resWrap) resWrap.hidden = true;
      });

      fr?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fe = fr.elements;
        const jid = fe.result_jogo_id.value;
        const body = {};
        const pc = fe.placar_casa.value;
        const pf = fe.placar_fora.value;
        if (pc !== "") body.placar_casa = parseInt(pc, 10);
        if (pf !== "") body.placar_fora = parseInt(pf, 10);
        body.teve_prorrogacao = fe.teve_prorrogacao.checked;
        body.foi_para_penaltis = fe.foi_para_penaltis.checked;
        const pcp = fe.penaltis_casa.value;
        const pfp = fe.penaltis_fora.value;
        if (pcp !== "") body.penaltis_casa = parseInt(pcp, 10);
        if (pfp !== "") body.penaltis_fora = parseInt(pfp, 10);
        const cid = fe.classificado_id.value;
        body.classificado_id = cid ? parseInt(cid, 10) : null;
        try {
          await api("/jogos/" + jid + "/resultado", { method: "PATCH", body });
          toast("Resultado salvo");
          resWrap.hidden = true;
          loadAdminJogos();
          await refreshPalpites();
          await renderPalpitesCrono();
          await renderPalpitesGrupos();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });

      wrap.querySelectorAll(".btn-admin-j-fin").forEach((b) => {
        b.addEventListener("click", async () => {
          const id = parseInt(b.dataset.jid, 10);
          if (!window.confirm("Finalizar este jogo?")) return;
          try {
            await api("/jogos/" + id + "/finalizar", { method: "PATCH" });
            toast("Jogo finalizado");
            loadAdminJogos();
            await refreshPalpites();
            await renderPalpitesCrono();
            await renderPalpitesGrupos();
            await loadRankingPanel();
          } catch (e) {
            toast(e.message || "Erro", true);
          }
        });
      });
    } catch (e) {
      wrap.innerHTML = "<p>Erro ao montar admin jogos.</p>";
      toast(e.message, true);
    }
  }

  async function reloadPaisesState() {
    try {
      state.paises = await api("/paises");
    } catch {
      /* ignore */
    }
  }

  async function loadAdminPaises() {
    const wrap = $("#admin-paises");
    if (!wrap) return;
    wrap.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      const paises = await api("/paises");
      state.paises = paises;
      const rows = paises
        .map(
          (p) =>
            `<tr>` +
            `<td>${p.id}</td>` +
            `<td>${escapeHtml(p.nome)}</td>` +
            `<td>${escapeHtml(p.sigla)}</td>` +
            `<td>${escapeHtml(p.grupo || "—")}</td>` +
            `<td class="admin-actions"><button type="button" class="btn btn-secondary btn-admin-p-edit" data-pid="${p.id}">Editar</button></td>` +
            `</tr>`
        )
        .join("");
      wrap.innerHTML =
        `<p class="admin-help"><strong>Países:</strong> use apenas para ajustar nome, sigla, URL da bandeira ou letra do grupo dos países já cadastrados. Não há cadastro de país novo por aqui.</p>` +
        `<div class="card admin-form-section"><h3>Editar país</h3>` +
        `<form id="form-admin-pais-edit" class="form-grid-2">` +
        `<input type="hidden" name="id" value="" />` +
        `<label>Nome<input type="text" name="nome" required /></label>` +
        `<label>Sigla<input type="text" name="sigla" required maxlength="8" /></label>` +
        `<label style="grid-column:1/-1">URL bandeira<input type="text" name="bandeira_url" required /></label>` +
        `<label>Grupo<input type="text" name="grupo" maxlength="16" /></label>` +
        `<div style="grid-column:1/-1"><button type="submit" class="btn btn-primary">Salvar alterações</button></div>` +
        `</form></div>` +
        `<div class="table-scroll card"><table class="admin-table"><thead><tr><th>ID</th><th>Nome</th><th>Sigla</th><th>Grupo</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;

      const fe = $("#form-admin-pais-edit");
      wrap.querySelectorAll(".btn-admin-p-edit").forEach((b) => {
        b.addEventListener("click", () => {
          const id = parseInt(b.dataset.pid, 10);
          const p = paises.find((x) => x.id === id);
          if (!p || !fe) return;
          fe.id.value = String(p.id);
          fe.nome.value = p.nome;
          fe.sigla.value = p.sigla;
          fe.bandeira_url.value = p.bandeira_url;
          fe.grupo.value = p.grupo || "";
          fe.scrollIntoView({ behavior: "smooth" });
        });
      });

      fe?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const f = fe;
        const id = f.id.value;
        try {
          await api("/paises/" + id, {
            method: "PUT",
            body: {
              nome: f.nome.value.trim(),
              sigla: f.sigla.value.trim(),
              bandeira_url: f.bandeira_url.value.trim(),
              grupo: f.grupo.value.trim() || null,
            },
          });
          toast("País atualizado");
          await reloadPaisesState();
          loadAdminPaises();
          await loadEspeciaisPanel();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });
    } catch (e) {
      wrap.innerHTML = "<p>Erro.</p>";
      toast(e.message, true);
    }
  }

  async function loadAdminUsuarios() {
    const wrap = $("#admin-usuarios");
    if (!wrap) return;
    wrap.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      const users = await api("/usuarios");
      const rows = users
        .map(
          (u) =>
            `<tr>` +
            `<td>${u.id}</td>` +
            `<td>${escapeHtml(u.nome)}</td>` +
            `<td>${escapeHtml(u.email)}</td>` +
            `<td>${escapeHtml(u.tipo_usuario)}</td>` +
            `<td>${u.ativo ? "Sim" : "Não"}</td>` +
            `<td>${u.primeiro_login ? "Pendente" : "OK"}</td>` +
            `<td class="admin-actions">` +
            `<button type="button" class="btn btn-secondary btn-admin-u-edit" data-uid="${u.id}">Editar</button>` +
            `<button type="button" class="btn btn-secondary btn-admin-u-toggle" data-uid="${u.id}" data-ativo="${u.ativo}">${u.ativo ? "Desativar" : "Ativar"}</button>` +
            `<button type="button" class="btn btn-secondary btn-admin-u-pw" data-uid="${u.id}">Nova senha</button>` +
            `</td></tr>`
        )
        .join("");
      wrap.innerHTML =
        `<div class="card"><h3 style="margin:0 0 0.75rem;font-size:1rem;color:var(--brand)">Novo usuário</h3>` +
        `<form id="form-admin-user-new" class="form-grid-2">` +
        `<label>Nome<input type="text" name="nome" required /></label>` +
        `<label>E-mail<input type="email" name="email" required /></label>` +
        `<label>Senha<input type="password" name="senha_plana" required minlength="8" autocomplete="new-password" /></label>` +
        `<label>Tipo<select name="tipo_usuario"><option value="usuario">usuario</option><option value="admin">admin</option></select></label>` +
        `<label>Função<input type="text" name="funcao" /></label>` +
        `<div style="grid-column:1/-1"><button type="submit" class="btn btn-primary">Criar</button></div>` +
        `</form></div>` +
        `<div class="card admin-form-section"><h3>Editar usuário</h3>` +
        `<form id="form-admin-user-edit" class="form-grid-2">` +
        `<input type="hidden" name="id" value="" />` +
        `<label>Nome<input type="text" name="nome" required /></label>` +
        `<label>E-mail<input type="email" name="email" required /></label>` +
        `<label>Função<input type="text" name="funcao" /></label>` +
        `<label>Tipo<select name="tipo_usuario"><option value="usuario">usuario</option><option value="admin">admin</option></select></label>` +
        `<label style="grid-column:1/-1">URL imagem<input type="url" name="imagem_perfil" /></label>` +
        `<div style="grid-column:1/-1"><button type="submit" class="btn btn-primary">Salvar</button></div>` +
        `</form></div>` +
        `<div class="table-scroll card"><table class="admin-table"><thead><tr>` +
        `<th>ID</th><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Ativo</th><th>1º login</th><th>Ações</th>` +
        `</tr></thead><tbody>${rows}</tbody></table></div>`;

      $("#form-admin-user-new")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const f = ev.target;
        try {
          await api("/usuarios", {
            method: "POST",
            body: {
              nome: f.nome.value.trim(),
              email: f.email.value.trim(),
              senha_plana: f.senha_plana.value,
              tipo_usuario: f.tipo_usuario.value,
              funcao: f.funcao.value.trim() || null,
              ativo: true,
              primeiro_login: true,
              imagem_perfil: null,
            },
          });
          toast("Usuário criado");
          f.reset();
          loadAdminUsuarios();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });

      const fue = $("#form-admin-user-edit");
      wrap.querySelectorAll(".btn-admin-u-edit").forEach((b) => {
        b.addEventListener("click", () => {
          const id = parseInt(b.dataset.uid, 10);
          const u = users.find((x) => x.id === id);
          if (!u || !fue) return;
          fue.id.value = String(u.id);
          fue.nome.value = u.nome;
          fue.email.value = u.email;
          fue.funcao.value = u.funcao || "";
          fue.tipo_usuario.value = u.tipo_usuario;
          fue.imagem_perfil.value = u.imagem_perfil || "";
          fue.scrollIntoView({ behavior: "smooth" });
        });
      });

      fue?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const id = fue.id.value;
        try {
          await api("/usuarios/" + id, {
            method: "PUT",
            body: {
              nome: fue.nome.value.trim(),
              email: fue.email.value.trim(),
              funcao: fue.funcao.value.trim() || null,
              tipo_usuario: fue.tipo_usuario.value,
              imagem_perfil: fue.imagem_perfil.value.trim() || null,
            },
          });
          toast("Usuário atualizado");
          state.user = await api("/auth/me");
          $("#main-user-label").textContent = state.user.nome || "Bolão";
          loadAdminUsuarios();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });

      wrap.querySelectorAll(".btn-admin-u-toggle").forEach((b) => {
        b.addEventListener("click", async () => {
          const id = parseInt(b.dataset.uid, 10);
          const ativo = b.dataset.ativo === "true";
          try {
            await api("/usuarios/" + id + "/status", { method: "PATCH", body: { ativo: !ativo } });
            toast("Status atualizado");
            loadAdminUsuarios();
          } catch (e) {
            toast(e.message || "Erro", true);
          }
        });
      });

      wrap.querySelectorAll(".btn-admin-u-pw").forEach((b) => {
        b.addEventListener("click", async () => {
          const id = parseInt(b.dataset.uid, 10);
          const pw = window.prompt("Nova senha (mín. 8 caracteres):");
          if (!pw || pw.length < 8) {
            toast("Senha inválida.", true);
            return;
          }
          try {
            await api("/usuarios/" + id + "/reset-password", { method: "PATCH", body: { senha_plana: pw } });
            toast("Senha alterada");
          } catch (e) {
            toast(e.message || "Erro", true);
          }
        });
      });
    } catch (e) {
      wrap.innerHTML = "<p>Erro ao listar usuários (admin?).</p>";
      toast(e.message, true);
    }
  }

  async function renderAdminMarcadoresCandidatosPanel() {
    const mount = $("#admin-marc-candidatos-mount");
    if (!mount) return;
    mount.innerHTML = '<p class="meta-line">Carregando lista de jogadores…</p>';
    let lista = [];
    try {
      lista = await api("/marcadores-brasil/candidatos/admin");
    } catch (e) {
      mount.innerHTML = `<p class="meta-line">${escapeHtml(e.message || "Erro ao carregar candidatos.")}</p>`;
      return;
    }
    const rows = lista
      .map(
        (c) =>
          `<tr>` +
          `<td>${c.id}</td>` +
          `<td>${escapeHtml(c.nome)}</td>` +
          `<td>${c.ativo ? "Sim" : "Não"}</td>` +
          `<td class="admin-actions">` +
          `<button type="button" class="btn btn-secondary btn-mb-cand-toggle" data-id="${c.id}" data-ativo="${c.ativo}">${c.ativo ? "Ocultar da lista" : "Reativar"}</button>` +
          `</td></tr>`
      )
      .join("");
    mount.innerHTML =
      `<p class="admin-help" style="margin-top:0"><strong>Jogadores sugeridos (banco de dados):</strong> cada nome cadastrado aparece como sugestão (dropdown) nos marcadores do Brasil — na tela do participante e ao lançar o resultado oficial abaixo. Você pode ocultar nomes sem apagar o histórico.</p>` +
      `<form id="form-mb-candidato-new" class="admin-toolbar" style="flex-wrap:wrap;align-items:flex-end">` +
      `<label style="flex:1;min-width:200px;margin:0">Novo jogador<input type="text" name="nome" required maxlength="255" placeholder="Ex.: Neymar"/></label>` +
      `<button type="submit" class="btn btn-primary" style="width:auto">Incluir na lista</button>` +
      `</form>` +
      `<div class="table-scroll card" style="margin-top:0.75rem"><table class="admin-table"><thead><tr><th>ID</th><th>Nome</th><th>Ativo</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nenhum candidato cadastrado.</td></tr>'}</tbody></table></div>`;

    $("#form-mb-candidato-new")?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const nome = (f.nome && f.nome.value ? f.nome.value : "").trim();
      if (!nome) return;
      try {
        await api("/marcadores-brasil/candidatos", { method: "POST", body: { nome } });
        toast("Jogador incluído na lista");
        f.nome.value = "";
        await renderAdminMarcadoresCandidatosPanel();
      } catch (e) {
        toast(e.message || "Erro", true);
      }
    });

    mount.querySelectorAll(".btn-mb-cand-toggle").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = parseInt(b.dataset.id, 10);
        const ativo = b.dataset.ativo === "true";
        try {
          await api("/marcadores-brasil/candidatos/" + id, { method: "PUT", body: { ativo: !ativo } });
          toast(ativo ? "Nome oculto da lista" : "Nome reativado");
          await renderAdminMarcadoresCandidatosPanel();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });
    });
  }

  async function loadAdminMarcadores() {
    const wrap = $("#admin-marcadores");
    if (!wrap) return;
    wrap.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      const jogosBr = await api("/jogos/brasil");
      const opts = jogosBr
        .map((j) => {
          const lab =
            j.tipo_fase === "mata_mata" ? faseMataMataLabel(j.fase) : String(j.fase || "");
          return `<option value="${j.id}">${escapeHtml(lab)} — ${escapeHtml(j.pais_casa.sigla)}×${escapeHtml(j.pais_fora.sigla)} (${j.id})</option>`;
        })
        .join("");
      wrap.innerHTML =
        `<div id="admin-marc-candidatos-mount" class="card admin-form-section" style="margin-bottom:1rem"></div>` +
        `<div class="card">` +
        `<p class="admin-help"><strong>Marcadores do Brasil (admin):</strong> aqui você informa o <strong>resultado oficial</strong> de quem marcou gol(es) pela Seleção naquele jogo (nome do jogador + quantidade). Isso alimenta a pontuação extra de quem acertou os palpites de “marcadores do Brasil”. ` +
        `Passos: (1) escolha um jogo em que o Brasil joga; (2) preencha as linhas; (3) <strong>Salvar resultado</strong>; (4) opcionalmente use <strong>Recalcular pontuação</strong> para atualizar o ranking após mudanças.</p>` +
        `<label>Jogo com o Brasil<select id="admin-marc-jogo-sel"><option value="">— escolha um jogo —</option>${opts}</select></label>` +
        (jogosBr.length === 0 ? `<p class="meta-line">Nenhum jogo cadastrado com o Brasil (BR) como casa ou visitante.</p>` : "") +
        `<div id="admin-marc-body" class="admin-form-section" style="border:none;padding-top:0.5rem"></div>` +
        `<div class="admin-toolbar"><button type="button" class="btn btn-secondary" id="btn-admin-marc-recalc" disabled>Recalcular pontuação (jogo)</button></div>` +
        `</div>`;

      await renderAdminMarcadoresCandidatosPanel();

      async function loadMarcForJogo(jogoId) {
        const body = $("#admin-marc-body");
        const btnR = $("#btn-admin-marc-recalc");
        if (!body) return;
        if (!jogoId) {
          body.innerHTML = "";
          if (btnR) btnR.disabled = true;
          return;
        }
        body.innerHTML = '<p class="meta-line">Carregando marcadores…</p>';
        if (btnR) {
          btnR.disabled = false;
          btnR.onclick = async () => {
            try {
              await api("/marcadores-brasil/recalcular/" + jogoId, { method: "PATCH" });
              toast("Recálculo disparado");
              await loadRankingPanel();
            } catch (e) {
              toast(e.message || "Erro", true);
            }
          };
        }
        let rows = [];
        try {
          rows = await api("/marcadores-brasil/admin/" + jogoId);
        } catch (e) {
          toast(e.message || "Erro ao carregar", true);
          rows = [];
        }
        let candNomes = [];
        try {
          const candRows = await api("/marcadores-brasil/candidatos");
          candNomes = (candRows || []).map((c) => c.nome);
        } catch {
          candNomes = [];
        }
        const dlIdAdm = "dl-mb-admin-" + jogoId;
        const dlHtml = `<datalist id="${dlIdAdm}">${datalistOptionsFromStrings(candNomes)}</datalist>`;
        const listAttr = ` list="${dlIdAdm}" autocomplete="off"`;
        const linhas = rows.length
          ? rows
              .map(
                (r, i) =>
                  `<div class="marcador-linha admin-marc-row" data-i="${i}">` +
                  `<input type="text" name="nome" value="${escapeHtml(r.nome_jogador)}" placeholder="Jogador (lista ou digite)" ${listAttr} />` +
                  `<input type="number" min="0" name="qtd" value="${r.quantidade_gols}" aria-label="Gols" />` +
                  `</div>`
              )
              .join("")
          : `<div class="marcador-linha"><input type="text" name="nome" placeholder="Jogador (lista ou digite)" ${listAttr}/><input type="number" min="0" name="qtd" value="0"/></div>`;

        body.innerHTML =
          dlHtml +
          `<p class="meta-line">Resultado oficial dos marcadores (Brasil)</p>` +
          `<div id="admin-marc-lines">${linhas}</div>` +
          `<div class="btn-row">` +
          `<button type="button" class="btn btn-secondary" id="btn-admin-marc-add">Adicionar linha</button>` +
          `<button type="button" class="btn btn-primary" id="btn-admin-marc-save">Salvar resultado</button>` +
          `</div>`;

        $("#btn-admin-marc-add")?.addEventListener("click", () => {
          const wrapL = $("#admin-marc-lines");
          const d = document.createElement("div");
          d.className = "marcador-linha";
          d.innerHTML = `<input type="text" name="nome" placeholder="Jogador (lista ou digite)" list="${dlIdAdm}" autocomplete="off"/><input type="number" min="0" name="qtd" value="0"/>`;
          wrapL?.appendChild(d);
        });

        $("#btn-admin-marc-save")?.addEventListener("click", async () => {
          const wrapL = $("#admin-marc-lines");
          const marcadores = [];
          $all(".marcador-linha", wrapL).forEach((ln) => {
            const nome = (ln.querySelector('[name="nome"]') || {}).value;
            const q = parseInt((ln.querySelector('[name="qtd"]') || {}).value, 10);
            if (nome && nome.trim()) marcadores.push({ nome_jogador: nome.trim(), quantidade_gols: Number.isFinite(q) && q >= 0 ? q : 0 });
          });
          try {
            await api("/marcadores-brasil/resultado/" + jogoId, { method: "PUT", body: { marcadores } });
            toast("Marcadores oficiais salvos");
            await loadRankingPanel();
          } catch (e) {
            toast(e.message || "Erro", true);
          }
        });
      }

      $("#admin-marc-jogo-sel")?.addEventListener("change", (ev) => {
        const v = ev.target.value;
        loadMarcForJogo(v ? parseInt(v, 10) : 0);
      });
    } catch (e) {
      wrap.innerHTML = "<p>Erro.</p>";
      toast(e.message, true);
    }
  }

  async function loadAdminEspeciaisAdm() {
    const wrap = $("#admin-especiais-adm");
    if (!wrap) return;
    wrap.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      await reloadPaisesState();
      let lista = [];
      try {
        lista = await api("/palpites-especiais");
      } catch (e) {
        toast(e.message || "Sem permissão ou erro na lista de especiais", true);
      }
      let res = null;
      try {
        res = await api("/resultados-especiais");
      } catch {
        res = null;
      }

      const rows = lista
        .map(
          (p) =>
            `<tr>` +
            `<td>${p.usuario.id}</td>` +
            `<td>${escapeHtml(p.usuario.nome)}</td>` +
            `<td class="num">${p.pontuacao_total}</td>` +
            `<td>${p.bloqueado ? "Sim" : "Não"}</td>` +
            `</tr>`
        )
        .join("");

      const campeaoOpts = (state.paises || [])
        .map(
          (x) =>
            `<option value="${x.id}" ${res && res.campeao_id === x.id ? "selected" : ""}>${escapeHtml(x.nome)}</option>`
        )
        .join("");

      const opEsp = getOpcoesEspeciais();
      const taLines = (arr) => escapeHtml(arr.join("\n"));
      const dlAdmMj = datalistOptionsFromStrings(opEsp.melhor_jogador);
      const dlAdmArt = datalistOptionsFromStrings(opEsp.artilheiro);
      const dlAdmGol = datalistOptionsFromStrings(opEsp.melhor_goleiro);

      wrap.innerHTML =
        `<div class="card admin-toolbar">` +
        `<button type="button" class="btn btn-secondary" id="btn-pe-recalc">Recalcular todos os palpites especiais</button>` +
        `</div>` +
        `<div class="card admin-form-section"><h3>Listas para as categorias especiais</h3>` +
        `<p class="admin-help" style="margin-top:0">Uma <strong>linha</strong> em cada caixa = uma opção que aparece na lista ao preencher <em>melhor jogador</em>, <em>artilheiro</em> e <em>melhor goleiro</em> (tela do usuário e resultado oficial abaixo). Quem preenche pode ainda digitar um nome fora da lista. As listas ficam salvas neste navegador.</p>` +
        `<form id="form-admin-opcoes-especiais" class="form-grid-2">` +
        `<label style="grid-column:1/-1">Opções — melhor jogador<textarea name="lines_mj" rows="5" placeholder="Um nome por linha">${taLines(opEsp.melhor_jogador)}</textarea></label>` +
        `<label style="grid-column:1/-1">Opções — artilheiro<textarea name="lines_art" rows="5" placeholder="Um nome por linha">${taLines(opEsp.artilheiro)}</textarea></label>` +
        `<label style="grid-column:1/-1">Opções — melhor goleiro<textarea name="lines_gol" rows="5" placeholder="Um nome por linha">${taLines(opEsp.melhor_goleiro)}</textarea></label>` +
        `<div style="grid-column:1/-1"><button type="submit" class="btn btn-primary">Salvar listas</button></div>` +
        `</form></div>` +
        `<div class="table-scroll card"><table class="admin-table"><thead><tr><th>Usuário ID</th><th>Nome</th><th>Pts total</th><th>Bloq.</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nenhum palpite.</td></tr>'}</tbody></table></div>` +
        `<datalist id="dl-adm-mj">${dlAdmMj}</datalist>` +
        `<datalist id="dl-adm-art">${dlAdmArt}</datalist>` +
        `<datalist id="dl-adm-gol">${dlAdmGol}</datalist>` +
        `<div class="card admin-form-section"><h3>Resultado oficial (especiais)</h3>` +
        `<form id="form-admin-resp-especial" class="form-grid-2">` +
        `<label>Campeão<select name="campeao_id"><option value="">—</option>${campeaoOpts}</select></label>` +
        `<label>Melhor jogador<input type="text" name="melhor_jogador" list="dl-adm-mj" autocomplete="off" value="${res && res.melhor_jogador ? escapeHtml(res.melhor_jogador) : ""}" placeholder="Lista ou digite"/></label>` +
        `<label>Artilheiro<input type="text" name="artilheiro" list="dl-adm-art" autocomplete="off" value="${res && res.artilheiro ? escapeHtml(res.artilheiro) : ""}" placeholder="Lista ou digite"/></label>` +
        `<label>Melhor goleiro<input type="text" name="melhor_goleiro" list="dl-adm-gol" autocomplete="off" value="${res && res.melhor_goleiro ? escapeHtml(res.melhor_goleiro) : ""}" placeholder="Lista ou digite"/></label>` +
        `<label><input type="checkbox" name="finalizado" ${res && res.finalizado ? "checked" : ""} disabled /> Finalizado (use o botão abaixo)</label>` +
        `<div style="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:0.5rem">` +
        `<button type="button" class="btn btn-primary" id="btn-resp-esp-save">${res ? "Atualizar resultado" : "Criar resultado"}</button>` +
        `<button type="button" class="btn btn-secondary" id="btn-resp-esp-fin">Finalizar resultado oficial</button>` +
        `</div></form></div>`;

      $("#form-admin-opcoes-especiais")?.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const splitLines = (s) =>
          String(s || "")
            .split(/\r?\n/)
            .map((x) => x.trim())
            .filter(Boolean);
        setOpcoesEspeciais({
          melhor_jogador: splitLines(f.lines_mj.value),
          artilheiro: splitLines(f.lines_art.value),
          melhor_goleiro: splitLines(f.lines_gol.value),
        });
        toast("Listas salvas. Reabra a aba Especiais do usuário se já estiver aberta.");
        loadAdminEspeciaisAdm();
      });

      $("#btn-pe-recalc")?.addEventListener("click", async () => {
        try {
          await api("/palpites-especiais/recalcular", { method: "PATCH" });
          toast("Recálculo de especiais executado");
          loadAdminEspeciaisAdm();
          await loadRankingPanel();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });

      const fre = $("#form-admin-resp-especial");
      $("#btn-resp-esp-save")?.addEventListener("click", async () => {
        if (!fre) return;
        const body = {
          campeao_id: fre.campeao_id.value ? parseInt(fre.campeao_id.value, 10) : null,
          melhor_jogador: fre.melhor_jogador.value.trim() || null,
          artilheiro: fre.artilheiro.value.trim() || null,
          melhor_goleiro: fre.melhor_goleiro.value.trim() || null,
          finalizado: !!(res && res.finalizado),
        };
        try {
          if (res) await api("/resultados-especiais", { method: "PUT", body });
          else await api("/resultados-especiais", { method: "POST", body });
          toast("Resultado especial salvo");
          loadAdminEspeciaisAdm();
          await loadRankingPanel();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });

      $("#btn-resp-esp-fin")?.addEventListener("click", async () => {
        if (!window.confirm("Finalizar resultado oficial dos especiais?")) return;
        try {
          await api("/resultados-especiais/finalizar", { method: "PATCH" });
          toast("Finalizado");
          loadAdminEspeciaisAdm();
          await loadRankingPanel();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });
    } catch (e) {
      wrap.innerHTML = "<p>Erro.</p>";
      toast(e.message, true);
    }
  }

  async function loadAdminConfig() {
    const wrap = $("#admin-config");
    if (!wrap) return;
    wrap.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
      const c = await api("/configuracao-bolao");
      wrap.innerHTML =
        `<div class="card"><form id="form-admin-config" class="form-grid-2">` +
        `<label style="grid-column:1/-1">Bloqueio palpites especiais (opcional)<input type="datetime-local" name="data_bloqueio_palpites_especiais" value="${c.data_bloqueio_palpites_especiais ? isoToDatetimeLocal(c.data_bloqueio_palpites_especiais) : ""}" /></label>` +
        `<label>Pontos campeão<input type="number" name="pontos_campeao" min="0" value="${c.pontos_campeao}" /></label>` +
        `<label>Pontos melhor jogador<input type="number" name="pontos_melhor_jogador" min="0" value="${c.pontos_melhor_jogador}" /></label>` +
        `<label>Pontos artilheiro<input type="number" name="pontos_artilheiro" min="0" value="${c.pontos_artilheiro}" /></label>` +
        `<label>Pontos goleiro<input type="number" name="pontos_melhor_goleiro" min="0" value="${c.pontos_melhor_goleiro}" /></label>` +
        `<label>Placar exato<input type="number" name="pontos_placar_exato" min="0" value="${c.pontos_placar_exato}" /></label>` +
        `<label>Resultado correto<input type="number" name="pontos_resultado_correto" min="0" value="${c.pontos_resultado_correto}" /></label>` +
        `<label>Classificado mata-mata<input type="number" name="pontos_classificado_mata_mata" min="0" value="${c.pontos_classificado_mata_mata}" /></label>` +
        `<label>Marcador Brasil<input type="number" name="pontos_marcador_brasil" min="0" value="${c.pontos_marcador_brasil}" /></label>` +
        `<label>Marcador BR + qtd<input type="number" name="pontos_marcador_brasil_com_quantidade" min="0" value="${c.pontos_marcador_brasil_com_quantidade}" /></label>` +
        `<div style="grid-column:1/-1"><button type="submit" class="btn btn-primary">Salvar configuração</button></div>` +
        `</form></div>`;

      $("#form-admin-config")?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const f = ev.target;
        const bloq = f.data_bloqueio_palpites_especiais.value;
        const body = {
          data_bloqueio_palpites_especiais: bloq ? datetimeLocalToIso(bloq) : null,
          pontos_campeao: parseInt(f.pontos_campeao.value, 10) || 0,
          pontos_melhor_jogador: parseInt(f.pontos_melhor_jogador.value, 10) || 0,
          pontos_artilheiro: parseInt(f.pontos_artilheiro.value, 10) || 0,
          pontos_melhor_goleiro: parseInt(f.pontos_melhor_goleiro.value, 10) || 0,
          pontos_placar_exato: parseInt(f.pontos_placar_exato.value, 10) || 0,
          pontos_resultado_correto: parseInt(f.pontos_resultado_correto.value, 10) || 0,
          pontos_classificado_mata_mata: parseInt(f.pontos_classificado_mata_mata.value, 10) || 0,
          pontos_marcador_brasil: parseInt(f.pontos_marcador_brasil.value, 10) || 0,
          pontos_marcador_brasil_com_quantidade: parseInt(f.pontos_marcador_brasil_com_quantidade.value, 10) || 0,
        };
        try {
          await api("/configuracao-bolao", { method: "PUT", body });
          toast("Configuração salva");
          await loadEspeciaisPanel();
        } catch (e) {
          toast(e.message || "Erro", true);
        }
      });
    } catch (e) {
      wrap.innerHTML = "<p>Erro ao carregar configuração (apenas admin).</p>";
      toast(e.message, true);
    }
  }

  function initAdminNav() {
    $all(".admin-sub-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!isAdmin()) return;
        $all(".admin-sub-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const sub = btn.dataset.adminSub;
        $all(".admin-sub-panel").forEach((el) => el.classList.toggle("active", el.id === "admin-" + sub));
        refreshActiveAdminPanel();
      });
    });
  }

  function initNav() {
    $all(".nav-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.panel === "admin" && !isAdmin()) {
          toast("Acesso restrito a administradores.", true);
          return;
        }
        $all(".nav-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const p = btn.dataset.panel;
        $all(".panel").forEach((el) => el.classList.toggle("active", el.id === "panel-" + p));
        if (p === "admin" && isAdmin()) refreshActiveAdminPanel();
      });
    });
    $all(".sub-pill").forEach((btn) => {
      if (btn.classList.contains("admin-sub-pill")) return;
      btn.addEventListener("click", () => {
        $all(".sub-pill").forEach((b) => {
          if (!b.classList.contains("admin-sub-pill")) b.classList.remove("active");
        });
        btn.classList.add("active");
        const s = btn.dataset.sub;
        $("#palpites-crono").classList.toggle("active", s === "crono");
        $("#palpites-grupos").classList.toggle("active", s === "grupos");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#form-login").addEventListener("submit", postLogin);
    $("#form-primeiro").addEventListener("submit", postPrimeiro);
    $("#btn-logout").addEventListener("click", logout);
    initNav();
    initAdminNav();
    state.token = localStorage.getItem(LS);
    if (state.token) {
      bootstrapMain();
    } else {
      showView("login");
      try {
        const em = sessionStorage.getItem("bolao_email");
        const emInput = $("#form-login")?.querySelector('[name="email"]');
        if (em && emInput) emInput.value = em;
      } catch {
        /* ignore */
      }
    }
  });
})();
