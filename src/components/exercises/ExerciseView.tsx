import type { Exercise } from '../../content/types';
import { Blend } from './Blend';
import { BuildWord } from './BuildWord';
import { ChooseLetter } from './ChooseLetter';
import { IntroLetter } from './IntroLetter';
import { MatchSyllables } from './MatchSyllables';
import { PickByEar } from './PickByEar';
import { PickPicture } from './PickPicture';
import { ReadItem } from './ReadItem';
import { SaySound } from './SaySound';
import type { ExerciseProps } from './types';

/** Єдина точка, яка знає, яким компонентом показувати кожен вид вправи. */
export function ExerciseView(props: ExerciseProps<Exercise>) {
  const { exercise: ex } = props;
  switch (ex.kind) {
    case 'intro-letter':
      return <IntroLetter {...props} exercise={ex} />;
    case 'find-letter':
    case 'letter-by-sound':
      return <ChooseLetter {...props} exercise={ex} />;
    case 'say-sound':
      return <SaySound {...props} exercise={ex} />;
    case 'blend':
      return <Blend {...props} exercise={ex} />;
    case 'read-syllable':
    case 'read-word':
      return <ReadItem {...props} exercise={ex} />;
    case 'build-word':
      return <BuildWord {...props} exercise={ex} />;
    case 'match-syllables':
      return <MatchSyllables {...props} exercise={ex} />;
    case 'pick-picture':
      return <PickPicture {...props} exercise={ex} />;
    case 'pick-by-ear':
      return <PickByEar {...props} exercise={ex} />;
  }
}
