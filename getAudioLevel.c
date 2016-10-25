#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <alsa/asoundlib.h>


static float GetLevel (void)
{
  float result = 0.0f;
  float sum = 0.0f;
  snd_pcm_t* waveform;

  // Open and initialize a waveform
  if (snd_pcm_open (&waveform, "hw:1,0",
		    SND_PCM_STREAM_CAPTURE, 0) != 0)
    return 0;

  // Set the hardware parameters
  if (!snd_pcm_set_params (waveform, SND_PCM_FORMAT_S16_LE,
			   SND_PCM_ACCESS_RW_INTERLEAVED, 1, 48000, 1, 0))
    {
      // Read current samples
      //short buffer[256];
      short buffer[12000];
      //if (snd_pcm_readi (waveform, buffer, 128) == 128)
      if (snd_pcm_readi (waveform, buffer, 12000) == 12000) 
	{
	  // Compute the maximum peak value
	  for (int i = 0; i < 12000; ++i)
	    {
	      // Substitute better algorithm here if needed
	      float s = buffer[i] / 32768.0f;
	      //if (s < 0) s *= -1;
	      //if (result < s) result = s;
	      sum += s*s;
	    }
	  result = sqrtf(sum/12000)*10000000;
	}
    }

  snd_pcm_close (waveform);
  return result;
}

int main() {
  int lv = GetLevel();
  printf("%d\n", lv);
  return EXIT_SUCCESS;
}
