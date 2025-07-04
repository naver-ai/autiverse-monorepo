export const getImageSource = (imageName: string) => {
  switch (imageName) {
    case 'robot':
      return require('../../../../assets/robot.png');
    case 'doll':
      return require('../../../../assets/doll.png');
    default:
      return require('../../../../assets/icon.png');
  }
}; 