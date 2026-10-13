globalThis.VerdiMessages = (() => {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function niche(lead) {
    const text = normalize(`${lead.segment || ''} ${lead.company || ''}`);
    if (/mecan|oficina|auto.?center/.test(text)) return 'mechanic';
    if (/carro|automovel|veiculo|concessionaria|revenda/.test(text)) return 'cars';
    if (/construc|materia|ferragem/.test(text)) return 'construction';
    if (/roupa|moda|vestu|confecc|boutique/.test(text)) return 'clothing';
    if (/restaurante|lanchonete|pizzaria|cafeteria/.test(text)) return 'restaurant';
    if (/barbear|salao|beleza/.test(text)) return 'beauty';
    if (/clinica|odont/.test(text)) return 'clinic';
    if (/mercado|mercearia/.test(text)) return 'market';
    return 'general';
  }
  const niches = {
    cars: ['os clientes costumam pedir fotos e detalhes dos carros pelo WhatsApp?', 'quais informações sobre os veículos vocês mais precisam repetir no atendimento?', 'um site da loja com catálogo do estoque, fotos e detalhes de cada veículo, endereço, horários e contato', 'as pessoas consultarem os carros antes de chamar vocês'],
    construction: ['os clientes costumam chamar para saber se vocês têm um material específico?', 'quais produtos geram mais pedidos de orçamento por aí?', 'um catálogo de produtos e marcas, com informações da loja e contato para orçamento', 'o cliente explicar melhor o que precisa ao pedir um orçamento'],
    clothing: ['as pessoas costumam perguntar pelas peças disponíveis no WhatsApp?', 'o que os clientes mais perguntam antes de visitar a loja?', 'uma vitrine com coleções, fotos das peças e informações da loja', 'o cliente conhecer as opções antes de conversar com a equipe'],
    mechanic: ['os clientes chegam mais por indicação ou encontram a oficina na internet?', 'quais serviços vocês mais querem destacar hoje?', 'uma página com os serviços, localização e contato da oficina', 'o cliente entender o atendimento e encontrar a oficina com facilidade'],
    restaurant: ['o pessoal costuma pedir o cardápio pelo WhatsApp?', 'o que gera mais dúvidas: cardápio, pedidos ou reservas?', 'uma página com cardápio, horários, endereço e canais de pedidos', 'as pessoas consultarem as informações antes de fazer o pedido'],
    beauty: ['os clientes costumam chamar para conhecer os serviços antes de agendar?', 'o que mais perguntam antes de marcar um horário?', 'uma página com serviços, trabalhos, localização e contato para agendamento', 'o cliente conhecer o trabalho antes de agendar'],
    clinic: ['as pessoas costumam chamar para saber quais atendimentos a clínica oferece?', 'quais informações gerais os pacientes mais procuram antes de agendar?', 'uma página com especialidades, equipe, localização e contato para agendamento', 'as pessoas encontrarem informações claras sobre a clínica'],
    market: ['os clientes costumam perguntar pelas ofertas pelo WhatsApp?', 'o que vocês mais querem divulgar: ofertas, variedade ou entregas?', 'uma página com ofertas, informações do mercado e canais de atendimento', 'os clientes encontrarem as informações do mercado em um só lugar'],
    general: ['os clientes chegam mais por indicação ou pela internet?', 'qual produto ou serviço vocês mais gostariam de destacar hoje?', 'uma apresentação digital dos produtos ou serviços, com informações e contato da empresa', 'o cliente conhecer melhor o negócio antes de entrar em contato'],
  };
  function templates(lead, channel = 'whatsapp') {
    const context = lead.outreach || {};
    const [question, discover, solution, benefit] = niches[niche(lead)];
    const company = lead.company || 'sua empresa';
    const compliment = context.compliment?.trim() || '[elogio sincero]';
    const detail = context.detail?.trim() || '[detalhe que você realmente observou]';
    const reply = context.reply?.trim() || '[resumo do que o cliente contou]';
    const first = channel === 'call'
      ? `Olá! Aqui é o Gustavo, da Verdi Tech Soluções. É um bom momento para conversarmos por um minuto?\n\n[Espere a resposta.]\n\n${compliment}. Reparei em ${detail}. Hoje, ${question}`
      : `Oi, pessoal da ${company}! Aqui é o Gustavo, da Verdi Tech Soluções. ${compliment}. Reparei em ${detail}. Hoje, ${question}`;
    return [
      { id: 'connect', name: '1 · Criar conexão', hint: 'Um elogio real, um detalhe específico e uma pergunta. Sem link, preço ou proposta.', text: first },
      { id: 'understand', name: '2 · Entender o negócio', hint: 'Após a resposta: comente o que ouviu antes da próxima pergunta.', text: `Entendi: ${reply}. Isso ajuda a entender como vocês atendem hoje. E ${discover}` },
      { id: 'presence', name: '3 · Conectar com a presença digital', hint: 'Relacione a conversa ao trabalho da Verdi Tech, sem prometer resultados.', text: `Pensando no que você comentou sobre ${reply}, talvez faça sentido organizar essas informações para o cliente consultar com mais facilidade. Na Verdi Tech Soluções, trabalhamos essa apresentação digital do negócio. Isso ajudaria no atendimento de vocês?` },
      { id: 'solution', name: '4 · Apresentar a solução', hint: 'Use quando houver interesse. Explique o uso prático, não uma proposta pronta.', text: `Para a ${company}, a ideia seria ${solution}. Assim, fica mais fácil para ${benefit}. Essa organização faria sentido para a rotina de vocês?` },
      { id: 'proof', name: '5 · Mostrar um trabalho real', hint: 'Peça permissão antes de enviar um exemplo. Nada de resultados inventados.', text: 'Posso te mostrar um exemplo do nosso trabalho para você avaliar se combina com o que conversamos? Sem compromisso.' },
      { id: 'followup', name: '6 · Retomar sem pressionar', hint: 'Uma retomada respeitosa. Não insista se a pessoa não quiser conversar.', text: `Oi, pessoal da ${company}! Sobre a nossa conversa: esse assunto faz sentido para vocês agora ou é melhor deixarmos para outro momento?` },
      { id: 'close', name: '7 · Respeitar o momento', hint: 'Encerre sem vender novamente e sem enviar links não solicitados.', text: `Obrigado pelo retorno! Sem problemas, respeito o momento de vocês. Se essa necessidade surgir no futuro, fico à disposição. Sucesso para a ${company}!` },
    ];
  }
  function validate(text, templateId) {
    if (!String(text || '').trim()) return 'Escreva a mensagem antes de continuar.';
    if (/\[(?:elogio sincero|detalhe que|resumo do que)/i.test(text)) return 'Personalize os campos entre colchetes antes de usar a mensagem.';
    if (templateId === 'connect' && /https?:\/\/|www\.|R\$|\bpre[çc]o\b|\bproposta\b|\bplano\b/i.test(text)) return 'No primeiro contato, retire links, preços, planos e propostas. Comece pela conversa.';
    return '';
  }
  function archive(leads, id, deleted = true, now = new Date().toISOString()) {
    return leads.map(lead => lead.id === id ? { ...lead, deletedAt: deleted ? now : null } : lead);
  }
  return { niche, templates, validate, archive };
})();
