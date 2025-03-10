export function* extensionLayout(x: number, y: number, roomName: string): Generator<RoomPosition> {
  const spawnX = x;
  const spawnY = y;
  yield new RoomPosition(x + 1, y + 1, roomName);
}

export default extensionLayout;
