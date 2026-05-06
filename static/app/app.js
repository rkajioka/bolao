/**
 * MVP Bolão — cliente estático (Etapa 12: UX + responsividade §18).
 * Abra a partir do mesmo host da API: http://localhost:8000/static/app/index.html
 */
(function () {
  "use strict";

  const LS = "bolao_access_token";
  const state = {
    token: null,
    user: null,
    paises: [],
    palpitesByJogo: new Map(),
    marcadoresCache: new Map(),
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

  async function api(path, opts = {}) {
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

  function jogoBloqueado(j) {
    if (j.finalizado) return true;
    const t = new Date(j.data_jogo).getTime();
    return Number.isFinite(t) && Date.now() >= t;
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
      toast(e.message || "Sessão inválida", true);
      logout();
      return;
    }
    $("#main-user-label").textContent = state.user.nome || "Bolão";
    showView("main");
    try {
      await refreshPalpites();
    } catch (e) {
      if (e.status === 403) {
        toast("Conclua o primeiro acesso para ver palpites.", true);
        showView("primeiro");
        return;
      }
      toast(e.message || "Não foi possível carregar palpites.", true);
      state.palpitesByJogo = new Map();
    }
    renderPalpitesCrono();
    renderPalpitesGrupos();
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

    return (
      `<article class="game-card" data-jogo-id="${j.id}" data-tipo-fase="${escapeHtml(j.tipo_fase)}">` +
      `<div class="game-card-header"><div>${statusBadges(j)}</div>` +
      `<div class="meta-line">${escapeHtml(j.fase)} · ${new Date(j.data_jogo).toLocaleString("pt-BR")}</div></div>` +
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
    body.dataset.loaded = "1";
    const dis = bloq ? "disabled" : "";
    const lines = rows.length
      ? rows
          .map(
            (r) =>
              `<div class="marcador-linha">` +
              `<input type="text" name="nome" placeholder="Jogador" value="${escapeHtml(r.nome_jogador)}" ${dis}/>` +
              `<input type="number" min="0" name="qtd" value="${escapeHtml(String(r.quantidade_gols))}" aria-label="Gols" ${dis}/>` +
              `</div>`
          )
          .join("")
      : `<div class="marcador-linha"><input type="text" name="nome" placeholder="Jogador" ${dis}/><input type="number" min="0" name="qtd" value="1" aria-label="Gols" ${dis}/></div>`;

    body.innerHTML =
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
        '<input type="text" name="nome" placeholder="Jogador"/><input type="number" min="0" name="qtd" value="1" aria-label="Gols"/>';
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
      renderPalpitesCrono();
      renderPalpitesGrupos();
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
      el.innerHTML = jogos.map(renderGameCard).join("") || "<p>Nenhum jogo cadastrado.</p>";
      wireGameCards(el);
    } catch (e) {
      el.innerHTML = "<p>Erro ao carregar jogos.</p>";
      toast(e.message, true);
    }
  }

  async function renderPalpitesGrupos() {
    const el = $("#palpites-grupos");
    el.innerHTML = '<p class="meta-line">Carregando…</p>';
    try {
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
      el.innerHTML =
        (bloq ? '<div class="blocked-banner">Palpites especiais bloqueados.</div>' : "") +
        `<form id="form-especiais" class="form-card" style="background:transparent;border:none;padding:0">` +
        `<label>Campeão<select name="campeao_id" ${bloq ? "disabled" : ""}><option value="">—</option>${campeaoOpts}</select></label>` +
        `<label>Melhor jogador<input type="text" name="melhor_jogador" value="${pe && pe.melhor_jogador ? escapeHtml(pe.melhor_jogador) : ""}" ${bloq ? "disabled" : ""}/></label>` +
        `<label>Artilheiro<input type="text" name="artilheiro" value="${pe && pe.artilheiro ? escapeHtml(pe.artilheiro) : ""}" ${bloq ? "disabled" : ""}/></label>` +
        `<label>Melhor goleiro<input type="text" name="melhor_goleiro" value="${pe && pe.melhor_goleiro ? escapeHtml(pe.melhor_goleiro) : ""}" ${bloq ? "disabled" : ""}/></label>` +
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
    showView("login");
  }

  function initNav() {
    $all(".nav-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        $all(".nav-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const p = btn.dataset.panel;
        $all(".panel").forEach((el) => el.classList.toggle("active", el.id === "panel-" + p));
      });
    });
    $all(".sub-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        $all(".sub-pill").forEach((b) => b.classList.remove("active"));
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
