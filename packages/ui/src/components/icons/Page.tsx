import { G, Path, Svg } from 'react-native-svg'

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import { createIcon } from '../factories/createIcon'

export const [Page, AnimatedPage] = createIcon({
  name: 'Page',
  getIcon: (props) => (
    <Svg viewBox="0 0 16 16" fill="none" {...props}>
      <G id="page">
        <Path
          id="Vector"
          d="M11.2533 10H13.48C13.44 10.06 13.3933 10.1067 13.34 10.16L10.16 13.34C10.1067 13.3933 10.06 13.44 10 13.48V11.2533C10 10.56 10.5599 10 11.2533 10ZM14 4.24666V8.56665C14 8.71332 13.9866 8.86 13.9533 9H11.2533C10.0066 9 9 10.0067 9 11.2533V13.9534C8.86 13.9867 8.7134 14 8.56673 14H4.25326C2.74659 14 2 13.2467 2 11.7467V4.24666C2 2.74666 2.74659 2 4.25326 2H11.7467C13.2534 2 14 2.74666 14 4.24666ZM8.5 9.33333C8.5 9.05733 8.276 8.83333 8 8.83333H5.33333C5.05733 8.83333 4.83333 9.05733 4.83333 9.33333C4.83333 9.60933 5.05733 9.83333 5.33333 9.83333H8C8.276 9.83333 8.5 9.60933 8.5 9.33333ZM11.1667 6.33333C11.1667 6.05733 10.9427 5.83333 10.6667 5.83333H5.33333C5.05733 5.83333 4.83333 6.05733 4.83333 6.33333C4.83333 6.60933 5.05733 6.83333 5.33333 6.83333H10.6667C10.9427 6.83333 11.1667 6.60933 11.1667 6.33333Z"
          fill={'currentColor' ?? '#9B9B9B'}
        />
      </G>
    </Svg>
  ),
  defaultFill: '#9B9B9B',
})
