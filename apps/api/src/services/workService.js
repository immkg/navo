async function deleteWorkItems(client, workIds) {
  if (!workIds || workIds.length === 0) return;

  await client.locationOption.deleteMany({
    where: { workId: { in: workIds } },
  });
  await client.work.deleteMany({ where: { id: { in: workIds } } });
}

module.exports = { deleteWorkItems };
